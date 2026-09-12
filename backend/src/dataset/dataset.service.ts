import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { DatasetRecord } from './dataset.entity';
import { PredictionRecord } from '../prediction/prediction.entity';

@Injectable()
export class DatasetService {
  private readonly logger = new Logger(DatasetService.name);

  constructor(
    @InjectRepository(DatasetRecord)
    private datasetRepo: Repository<DatasetRecord>,
    @InjectRepository(PredictionRecord)
    private predictionRepo: Repository<PredictionRecord>,
    private config: ConfigService,
  ) {}

  async upsertRow(partial: Partial<DatasetRecord> & { year: number; week: number; district: string }) {
    let record = await this.datasetRepo.findOne({
      where: { year: partial.year, week: partial.week, district: partial.district },
    });
    if (!record) {
      record = this.datasetRepo.create(partial);
    } else {
      for (const [key, value] of Object.entries(partial)) {
        if (value !== undefined) (record as any)[key] = value;
      }
    }
    return this.datasetRepo.save(record);
  }

  async importAllCsvs() {
    // Prefer the research final sheet / training CSV (full history).
    // Only fall back to thin weather/dengue CSVs when no training file exists.
    const training = await this.importTrainingCsvIfPresent();
    const weather = training > 0 ? 0 : await this.importWeatherCsv();
    const dengue = training > 0 ? 0 : await this.importDengueCsv();
    const predictions = await this.importPredictionsCsv();
    if (training > 0 || weather > 0 || dengue > 0) {
      await this.exportMlCsvs();
    }
    const stats = await this.getWeatherStats();
    this.logger.log(
      `CSV migrate: training=${training} weather=${weather} dengue=${dengue} predictions=${predictions} db_rows=${stats.rows} weeks=${stats.weeks}`,
    );
    return { weather, dengue, training, predictions, ...stats };
  }

  async importWeatherCsv(): Promise<number> {
    const csvPath = this.config.get<string>('paths.weatherCsv');
    if (!csvPath || !fs.existsSync(csvPath)) return 0;
    const rows = this.readCsv(csvPath);
    let count = 0;
    for (const row of rows) {
      const year = parseInt(row.year);
      const week = parseInt(row.week);
      const district = row.district;
      if (!year || !week || !district) continue;
      await this.upsertRow({
        year,
        week,
        district,
        avg_temp: this.num(row.avg_temp ?? row.avgtemp),
        avg_humidity: this.num(row.avg_humidity ?? row.humidity),
        total_rainfall: this.num(row.total_rainfall ?? row.precipitation ?? row.rainfall),
        avg_windspeed: this.num(row.avg_windspeed ?? row.wind_speed),
      });
      count++;
    }
    this.logger.log(`Imported ${count} weather rows into dataset`);
    return count;
  }

  async importDengueCsv(): Promise<number> {
    const csvPath = this.config.get<string>('paths.dengueCsv');
    if (!csvPath || !fs.existsSync(csvPath)) return 0;
    const rows = this.readCsv(csvPath);
    let count = 0;
    for (const row of rows) {
      const year = parseInt(row.year);
      const week = parseInt(row.week);
      const district = row.district;
      const cases = this.num(row.cases ?? row.dengue_cases);
      if (!year || !week || !district || cases == null) continue;
      await this.upsertRow({ year, week, district, dengue_cases: Math.round(cases) });
      count++;
    }
    this.logger.log(`Imported ${count} dengue rows`);
    return count;
  }

  async importTrainingCsvIfPresent(): Promise<number> {
    const candidates = [
      path.resolve(process.cwd(), 'data/training_dataset.csv'),
      path.resolve(process.cwd(), '../Data/final sheet/weather_dengue_population_merged.csv'),
      path.resolve(process.cwd(), '../Data/final sheet/training_dataset.csv'),
    ];
    const extra = candidates.find((p) => fs.existsSync(p) && fs.statSync(p).size > 100);
    if (!extra) return 0;
    const rows = this.readCsv(extra);
    const batch: Partial<DatasetRecord>[] = [];
    for (const row of rows) {
      let year = parseInt(row.year);
      let week = parseInt(row.week);
      if ((!year || !week) && (row.year_week || row.yearweek) && String(row.year_week || row.yearweek).includes('_')) {
        const [y, w] = String(row.year_week || row.yearweek).split('_');
        year = parseInt(y);
        week = parseInt(w);
      }
      const district = row.district;
      if (!year || !week || !district) continue;
      const cases = this.num(row.dengue_cases ?? row.cases);
      const districtId = this.num(row.district_id ?? row.districtid);
      batch.push({
        year,
        week,
        district,
        avg_temp: this.num(row.avg_temp),
        avg_humidity: this.num(row.avg_humidity),
        total_rainfall: this.num(row.total_rainfall ?? row.total_precip ?? row.precipitation),
        avg_windspeed: this.num(row.avg_windspeed ?? row.wind_speed),
        dengue_cases: cases != null ? Math.round(cases) : null,
        max_temp: this.num(row.max_temp),
        min_temp: this.num(row.min_temp),
        rainy_days: this.num(row.rainy_days),
        population_density: this.num(row.population_density),
        district_id: districtId != null ? Math.round(districtId) : null,
      });
    }
    const count = await this.bulkUpsert(batch);
    this.logger.log(`Imported ${count} training rows from ${extra}`);
    return count;
  }

  private async bulkUpsert(rows: Partial<DatasetRecord>[]): Promise<number> {
    if (!rows.length) return 0;
    const chunkSize = 500;
    let saved = 0;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await this.datasetRepo
        .createQueryBuilder()
        .insert()
        .into(DatasetRecord)
        .values(chunk)
        .orUpdate(
          [
            'avg_temp',
            'avg_humidity',
            'total_rainfall',
            'avg_windspeed',
            'dengue_cases',
            'max_temp',
            'min_temp',
            'rainy_days',
            'population_density',
            'district_id',
          ],
          ['year', 'week', 'district'],
        )
        .execute();
      saved += chunk.length;
    }
    return saved;
  }

  async importPredictionsCsv(): Promise<number> {
    const csvPath = this.config.get<string>('paths.predictionCsv');
    if (!csvPath || !fs.existsSync(csvPath)) return 0;
    const rows = this.readCsv(csvPath);
    let count = 0;
    for (const row of rows) {
      const district = row.district;
      const year = parseInt(row.predicted_year ?? row.year);
      const week = parseInt(row.predicted_week ?? row.week);
      if (!district || !year || !week) continue;
      let rec = await this.predictionRepo.findOne({
        where: { district, predicted_year: year, predicted_week: week },
      });
      if (!rec) {
        rec = this.predictionRepo.create({ district, predicted_year: year, predicted_week: week });
      }
      rec.predicted_cases = parseInt(row.predicted_cases ?? row.cases) || 0;
      rec.confidence_low = row.confidence_low != null && row.confidence_low !== '' ? parseInt(row.confidence_low) : null;
      rec.confidence_high = row.confidence_high != null && row.confidence_high !== '' ? parseInt(row.confidence_high) : null;
      await this.predictionRepo.save(rec);
      count++;
    }
    this.logger.log(`Imported ${count} prediction rows`);
    return count;
  }

  async exportMlCsvs(): Promise<void> {
    const records = await this.datasetRepo.find({
      order: { year: 'ASC', week: 'ASC', district: 'ASC' },
    });
    this.writeCsv(
      this.config.get<string>('paths.weatherCsv'),
      ['year', 'week', 'district', 'avg_temp', 'humidity', 'precipitation', 'wind_speed'],
      records.map((r) => ({
        year: r.year,
        week: r.week,
        district: r.district,
        avg_temp: r.avg_temp ?? '',
        humidity: r.avg_humidity ?? '',
        precipitation: r.total_rainfall ?? '',
        wind_speed: r.avg_windspeed ?? '',
      })),
    );
    this.writeCsv(
      this.config.get<string>('paths.dengueCsv'),
      ['district', 'week', 'year', 'cases'],
      records
        .filter((r) => r.dengue_cases != null)
        .map((r) => ({
          district: r.district,
          week: r.week,
          year: r.year,
          cases: r.dengue_cases,
        })),
    );
  }

  async toTrainingCsv() {
    const data = await this.datasetRepo.find({ order: { year: 'ASC', week: 'ASC', district: 'ASC' } });
    return this.csv(
      [
        'Year', 'Week', 'District', 'Avg_Temp', 'Avg_Humidity', 'Total_Rainfall', 'Avg_Windspeed',
        'Dengue_Cases', 'Max_Temp', 'Min_Temp', 'Rainy_Days', 'Population_Density', 'District_Id',
      ],
      data.map((r) => [
        r.year, r.week, r.district, r.avg_temp ?? '', r.avg_humidity ?? '', r.total_rainfall ?? '',
        r.avg_windspeed ?? '', r.dengue_cases ?? '', r.max_temp ?? '', r.min_temp ?? '',
        r.rainy_days ?? '', r.population_density ?? '', r.district_id ?? '',
      ]),
    );
  }

  async toWeatherCsv() {
    const data = await this.datasetRepo.find({ order: { year: 'ASC', week: 'ASC', district: 'ASC' } });
    return this.csv(
      ['Year', 'Week', 'District', 'Avg_Temp', 'Avg_Humidity', 'Total_Rainfall', 'Avg_Windspeed'],
      data.map((r) => [r.year, r.week, r.district, r.avg_temp ?? '', r.avg_humidity ?? '', r.total_rainfall ?? '', r.avg_windspeed ?? '']),
    );
  }

  async toPredictionsCsv() {
    const data = await this.predictionRepo.find({
      order: { predicted_year: 'ASC', predicted_week: 'ASC', district: 'ASC' },
    });
    return this.csv(
      ['District', 'Predicted_Year', 'Predicted_Week', 'Predicted_Cases', 'Confidence_Low', 'Confidence_High', 'Generated_At'],
      data.map((r) => [r.district, r.predicted_year, r.predicted_week, r.predicted_cases, r.confidence_low ?? '', r.confidence_high ?? '', r.generatedAt?.toISOString() ?? '']),
    );
  }

  private csv(headers: string[], rows: any[][]) {
    return [headers.join(','), ...rows.map((r) => r.join(','))].join('\n') + '\n';
  }

  async getWeatherStats() {
    const rows = await this.datasetRepo.count();
    const raw = await this.datasetRepo
      .createQueryBuilder('d')
      .select('COUNT(DISTINCT CONCAT(d.year, \'_\', d.week))', 'weeks')
      .addSelect('COUNT(DISTINCT d.district)', 'districts')
      .getRawOne();
    return {
      rows,
      weeks: parseInt(raw?.weeks || '0'),
      districts: parseInt(raw?.districts || '0'),
    };
  }

  private num(v: any): number | null {
    if (v === undefined || v === null || v === '') return null;
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  }

  private readCsv(csvPath: string): any[] {
    const content = fs.readFileSync(csvPath, 'utf-8').trim();
    if (!content) return [];
    const lines = content.split('\n');
    const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const values = lines[i].split(',');
      const row: any = {};
      headers.forEach((h, idx) => (row[h] = values[idx]?.trim() ?? ''));
      rows.push(row);
    }
    return rows;
  }

  private writeCsv(csvPath: string, headers: string[], rows: any[]) {
    const dir = path.dirname(csvPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const lines = [headers.join(',')];
    for (const row of rows) {
      lines.push(headers.map((h) => row[h] ?? '').join(','));
    }
    fs.writeFileSync(csvPath, lines.join('\n') + '\n');
  }
}
