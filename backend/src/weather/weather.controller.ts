import {
  Controller, Get, Post, Body, Query, Param,
  UploadedFile, UseInterceptors, BadRequestException, UseGuards
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { WeatherJobService } from '../weather-job/weather-job.service';
import { LoggingService } from '../logging/logging.service';
import { SchedulerService } from '../scheduler/scheduler.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatasetRecord } from '../dataset/dataset.entity';
import { DatasetService } from '../dataset/dataset.service';
import 'multer';

@Controller()
export class WeatherController {
  constructor(
    private readonly weatherJob: WeatherJobService,
    private readonly logging: LoggingService,
    private readonly scheduler: SchedulerService,
    private readonly dataset: DatasetService,
    @InjectRepository(DatasetRecord)
    private datasetRepo: Repository<DatasetRecord>,
  ) {}

  // ── Weather ──────────────────────────────────────────────
  @Post('weather/trigger')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async triggerWeather(@Query('dryRun') dryRun?: string, @Query('weeks') weeks?: string) {
    const n = Math.min(12, Math.max(1, parseInt(weeks || '1', 10) || 1));
    return this.weatherJob.backfillWeeks(n, dryRun === 'true');
  }

  @Get('weather/status')
  async getStatus() {
    const logs = this.logging.getLogs(10);
    const lastSuccess = logs.find(l => l.type === 'weather' && l.status === 'success');
    const stats = await this.dataset.getWeatherStats();
    return {
      status: 'ok',
      lastRun: lastSuccess?.startedAt ?? null,
      nextRun: this.scheduler.getNextRun(),
      weatherRows: stats.rows,
    };
  }

  @Get('weather/logs')
  getLogs(@Query('limit') limit?: string) {
    return this.logging.getLogs(parseInt(limit || '50'));
  }

  @Get('weather/data')
  async getWeatherData(@Query('week') week?: string, @Query('year') year?: string) {
    let q = this.datasetRepo.createQueryBuilder('d');
    if (week) q = q.andWhere('d.week = :week', { week: parseInt(week) });
    if (year) q = q.andWhere('d.year = :year', { year: parseInt(year) });
    const records = await q.getMany();
    // Map to old weather API structure (strings)
    return records.map(r => ({
      year: r.year.toString(),
      week: r.week.toString(),
      district: r.district,
      avg_temp: r.avg_temp?.toString() || '0',
      humidity: r.avg_humidity?.toString() || '0',
      avg_humidity: r.avg_humidity?.toString() || '0',
      precipitation: r.total_rainfall?.toString() || '0',
      wind_speed: r.avg_windspeed?.toString() || '0'
    }));
  }

  @Get('weather/data/stats')
  getWeatherStats() {
    return this.dataset.getWeatherStats();
  }

  // ── Predictions ──────────────────────────────────────────
  @Post('prediction/run')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async runPrediction(@Query('dryRun') dryRun?: string) {
    return this.weatherJob.runPrediction(dryRun === 'true');
  }

  @Get('prediction/latest')
  getLatestPredictions(@Query('week') week?: string, @Query('year') year?: string) {
    if (week) {
      return this.weatherJob.getPredictions(parseInt(week), year ? parseInt(year) : undefined);
    }
    return this.weatherJob.getLatestPredictions();
  }

  @Get('prediction/history')
  getAllPredictions() {
    return this.weatherJob.getPredictions();
  }

  // ── Dengue Counts ─────────────────────────────────────────
  @Get('dengue/counts')
  async getDengueCounts() {
    const records = await this.datasetRepo.find();
    return records.map(r => ({
      district: r.district,
      week: r.week.toString(),
      year: r.year.toString(),
      cases: r.dengue_cases?.toString() || '0'
    }));
  }

  @Post('dengue/counts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  async saveDengueCounts(@Body() body: { rows: any[] }) {
    if (!body?.rows?.length) throw new BadRequestException('rows array required');
    
    for (const row of body.rows) {
      if (!row.year || !row.week || !row.district) continue;
      
      let record = await this.datasetRepo.findOne({
        where: { year: parseInt(row.year), week: parseInt(row.week), district: row.district }
      });
      if (!record) {
        record = new DatasetRecord();
        record.year = parseInt(row.year);
        record.week = parseInt(row.week);
        record.district = row.district;
      }
      record.dengue_cases = row.cases ? parseInt(row.cases) : 0;
      await this.datasetRepo.save(record);
    }

    await this.dataset.exportMlCsvs();
    const log = this.logging.createLog('dengue_upload', false);
    this.logging.finalizeLog(log, true, { rows: body.rows.length });
    return { success: true, rows: body.rows.length };
  }

  @Post('dengue/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  @UseInterceptors(FileInterceptor('file'))
  async uploadDengueCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const text = file.buffer.toString('utf-8');
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const hasCases = headers.includes('cases') || headers.includes('dengue_cases');
    const required = ['district', 'week', 'year'];
    const missing = required.filter((h) => !headers.includes(h));
    if (missing.length || !hasCases) {
      throw new BadRequestException('CSV needs district, week, year, and cases (or Dengue_Cases)');
    }

    let imported = 0;
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = lines[i].split(',');
      const row: any = {};
      headers.forEach((h, idx) => { if (vals[idx] !== undefined) row[h] = vals[idx].trim(); });

      if (!row.year || !row.week || !row.district) continue;
      
      let record = await this.datasetRepo.findOne({
        where: { year: parseInt(row.year), week: parseInt(row.week), district: row.district }
      });
      if (!record) {
        record = new DatasetRecord();
        record.year = parseInt(row.year);
        record.week = parseInt(row.week);
        record.district = row.district;
      }
      record.dengue_cases = parseInt(row.cases ?? row.dengue_cases) || 0;
      await this.datasetRepo.save(record);
      imported++;
    }

    await this.dataset.exportMlCsvs();
    const log = this.logging.createLog('dengue_upload', false);
    this.logging.finalizeLog(log, true, { rows: imported });
    return { success: true, rows: imported };
  }
}
