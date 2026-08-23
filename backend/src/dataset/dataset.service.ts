import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { DatasetRecord } from './dataset.entity';

@Injectable()
export class DatasetService {
  private readonly logger = new Logger(DatasetService.name);

  constructor(
    @InjectRepository(DatasetRecord)
    private datasetRepo: Repository<DatasetRecord>,
    private config: ConfigService,
  ) {}

  async upsertRow(partial: Partial<DatasetRecord> & { year: number; week: number; district: string }) {
    let record = await this.datasetRepo.findOne({
      where: { year: partial.year, week: partial.week, district: partial.district },
    });
    if (!record) {
      record = this.datasetRepo.create(partial);
    } else {
      Object.assign(record, partial);
    }
    return this.datasetRepo.save(record);
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
