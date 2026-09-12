import { Injectable, Logger, BadRequestException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';
import { LoggingService } from '../logging/logging.service';
import { DatasetService } from '../dataset/dataset.service';
import { DatasetRecord } from '../dataset/dataset.entity';
import { PredictionRecord } from '../prediction/prediction.entity';
import { DISTRICTS, estimatePredictedCases, lastCompleteIsoWeek, lastNCompleteIsoWeeks, nextIsoWeek } from './districts';

@Injectable()
export class WeatherJobService implements OnModuleInit {
  private readonly logger = new Logger(WeatherJobService.name);

  constructor(
    private config: ConfigService,
    private logging: LoggingService,
    private dataset: DatasetService,
    @InjectRepository(DatasetRecord)
    private datasetRepo: Repository<DatasetRecord>,
    @InjectRepository(PredictionRecord)
    private predictionRepo: Repository<PredictionRecord>,
  ) {}

  async onModuleInit() {
    try {
      await this.dataset.importAllCsvs();
    } catch (err) {
      this.logger.error(`History bootstrap failed: ${err.message}`);
    }
  }

  async runWeatherFetch(dryRun = false): Promise<any> {
    return this.backfillWeeks(1, dryRun);
  }

  async backfillWeeks(weekCount = 4, dryRun = false): Promise<any> {
    const log = this.logging.createLog('weather', dryRun);
    const periods = lastNCompleteIsoWeeks(weekCount);
    const errors: string[] = [];
    let fetched = 0;

    try {
      for (const period of periods) {
        for (const [district, [lat, lon]] of Object.entries(DISTRICTS)) {
          try {
            const metrics = await this.fetchOpenMeteo(lat, lon, period.start, period.end);
            if (!dryRun) {
              await this.dataset.upsertRow({
                year: period.year,
                week: period.week,
                district,
                avg_temp: metrics.avg_temp,
                avg_humidity: metrics.avg_humidity,
                total_rainfall: metrics.total_rainfall,
                avg_windspeed: metrics.avg_windspeed,
              });
            }
            fetched++;
          } catch (err) {
            errors.push(`${district} W${period.week}: ${err.message}`);
          }
        }
      }

      if (!dryRun) await this.dataset.exportMlCsvs();
      const result = {
        success: errors.length < Object.keys(DISTRICTS).length * periods.length,
        districts_fetched: fetched,
        districts_failed: errors.length,
        weeks: periods.map((p) => ({ year: p.year, week: p.week, from: p.start, to: p.end })),
        date_from: periods[0]?.start,
        date_to: periods[periods.length - 1]?.end,
        dry_run: dryRun,
        errors: errors.slice(0, 12),
      };
      this.logging.finalizeLog(log, result.success, result);
      return result;
    } catch (err) {
      this.logging.finalizeLog(log, false, null, err.message);
      throw err;
    }
  }

  async runPrediction(dryRun = false): Promise<any> {
    const log = this.logging.createLog('prediction', dryRun);
    try {
      // The ML model needs 12 weeks of data (8 timesteps + 4 for rolling means)
      const REQUIRED_WEEKS = 12;
      const periods = lastNCompleteIsoWeeks(REQUIRED_WEEKS);

      // 1. Check availability for each required week and backfill if missing
      for (const period of periods) {
        const count = await this.datasetRepo.count({ where: { year: period.year, week: period.week } });
        if (count < Object.keys(DISTRICTS).length && !dryRun) {
          this.logger.log(`Missing data for W${period.week}/${period.year}. Fetching missing weather...`);
          for (const [district, [lat, lon]] of Object.entries(DISTRICTS)) {
            try {
              const metrics = await this.fetchOpenMeteo(lat, lon, period.start, period.end);
              await this.dataset.upsertRow({
                year: period.year,
                week: period.week,
                district,
                avg_temp: metrics.avg_temp,
                avg_humidity: metrics.avg_humidity,
                total_rainfall: metrics.total_rainfall,
                avg_windspeed: metrics.avg_windspeed,
              });
            } catch (err) {
              this.logger.warn(`Failed to fetch ${district} W${period.week}: ${err.message}`);
            }
          }
        }
      }

      // 2. Fetch all records, but filter to ONLY the required window (no need to send 8000+ rows)
      let records = await this.datasetRepo.find({
        order: { year: 'ASC', week: 'ASC', district: 'ASC' },
      });
      const periodKeys = new Set(periods.map((p) => `${p.year}-${p.week}`));
      records = records.filter((r) => periodKeys.has(`${r.year}-${r.week}`));

      if (!records.length) {
        throw new BadRequestException('No weather or case rows in the database for the required window.');
      }

      const payload = {
        dryRun,
        records: records.map((r) => ({
          year: r.year,
          week: r.week,
          district: r.district,
          avg_temp: r.avg_temp,
          avg_humidity: r.avg_humidity,
          total_rainfall: r.total_rainfall,
          avg_windspeed: r.avg_windspeed,
          dengue_cases: r.dengue_cases,
          max_temp: r.max_temp,
          min_temp: r.min_temp,
          rainy_days: r.rainy_days,
          population_density: r.population_density,
          district_id: r.district_id,
        })),
      };

      let predictions: any[] = [];
      let fallback = false;
      let engine = 'unknown';
      const mlUrl = this.config.get<string>('ml.serviceUrl');

      try {
        const response = await axios.post(`${mlUrl.replace(/\/$/, '')}/predict`, payload, { timeout: 180000 });
        predictions = response.data?.predictions || [];
        engine = response.data?.engine || 'http';
      } catch (err) {
        this.logger.warn(`ML host unavailable (${err.message}). Using local fallback.`);
        predictions = this.localPredict(records);
        fallback = true;
        engine = 'fallback';
      }

      if (!predictions.length) {
        throw new BadRequestException('Model returned no district predictions.');
      }

      if (!dryRun) {
        for (const p of predictions) {
          const year = Number(p.predicted_year);
          const week = Number(p.predicted_week);
          let row = await this.predictionRepo.findOne({
            where: { predicted_year: year, predicted_week: week, district: p.district },
          });
          if (!row) {
            row = this.predictionRepo.create({
              district: p.district,
              predicted_year: year,
              predicted_week: week,
            });
          }
          row.predicted_cases = Number(p.predicted_cases) || 0;
          row.confidence_low = p.confidence_low != null ? Number(p.confidence_low) : null;
          row.confidence_high = p.confidence_high != null ? Number(p.confidence_high) : null;
          row.fallback = fallback;
          await this.predictionRepo.save(row);
        }
        await this.dataset.exportMlCsvs();
      }

      const result = {
        success: true,
        district_count: predictions.length,
        dry_run: dryRun,
        fallback,
        engine,
        predictions,
      };
      this.logging.finalizeLog(log, true, result);
      return result;
    } catch (err) {
      this.logging.finalizeLog(log, false, null, err.message);
      throw err;
    }
  }

  async getPredictions(week?: number, year?: number) {
    const where: any = {};
    if (week) where.predicted_week = week;
    if (year) where.predicted_year = year;
    return this.predictionRepo.find({ where, order: { predicted_year: 'ASC', predicted_week: 'ASC', district: 'ASC' } });
  }

  async getLatestPredictions() {
    const newest = await this.predictionRepo.find({
      order: { predicted_year: 'DESC', predicted_week: 'DESC', id: 'DESC' },
      take: 1,
    });
    if (!newest.length) return [];
    return this.predictionRepo.find({
      where: {
        predicted_year: newest[0].predicted_year,
        predicted_week: newest[0].predicted_week,
      },
      order: { predicted_cases: 'DESC' },
    });
  }

  async getWeatherStats() {
    return this.dataset.getWeatherStats();
  }

  private localPredict(records: DatasetRecord[]) {
    const byDistrict = new Map<string, DatasetRecord[]>();
    for (const r of records) {
      const list = byDistrict.get(r.district) || [];
      list.push(r);
      byDistrict.set(r.district, list);
    }
    const out = [];
    for (const [district, rows] of byDistrict) {
      const latest = rows[rows.length - 1];
      const horizon = nextIsoWeek(latest.year, latest.week);
      const est = estimatePredictedCases({
        district,
        dengue_cases: latest.dengue_cases,
        avg_temp: latest.avg_temp,
        avg_humidity: latest.avg_humidity,
        total_rainfall: latest.total_rainfall,
      });
      out.push({
        district,
        ...est,
        predicted_week: horizon.week,
        predicted_year: horizon.year,
      });
    }
    return out;
  }

  private async fetchOpenMeteo(lat: number, lon: number, start: string, end: string) {
    const params = {
      latitude: lat,
      longitude: lon,
      start_date: start,
      end_date: end,
      daily: 'temperature_2m_mean,relative_humidity_2m_mean,precipitation_sum,wind_speed_10m_mean',
      timezone: 'Asia/Colombo',
    };
    let data: any;
    try {
      data = (await axios.get('https://api.open-meteo.com/v1/forecast', { timeout: 30000, params })).data;
    } catch {
      data = (await axios.get('https://archive-api.open-meteo.com/v1/archive', { timeout: 30000, params })).data;
    }
    const daily = data?.daily;
    if (!daily?.temperature_2m_mean?.length) {
      data = (await axios.get('https://archive-api.open-meteo.com/v1/archive', { timeout: 30000, params })).data;
    }
    const days = data?.daily;
    if (!days?.temperature_2m_mean?.length) {
      throw new Error('Open-Meteo returned no daily weather');
    }
    const avg = (arr: number[]) => arr.filter((n) => n != null).reduce((s, n) => s + n, 0) / (arr.filter((n) => n != null).length || 1);
    return {
      avg_temp: Number(avg(days.temperature_2m_mean).toFixed(2)),
      avg_humidity: Number(avg(days.relative_humidity_2m_mean || []).toFixed(2)),
      total_rainfall: Number((days.precipitation_sum || []).reduce((s, n) => s + (n || 0), 0).toFixed(2)),
      avg_windspeed: Number(avg(days.wind_speed_10m_mean || []).toFixed(2)),
    };
  }
}
