import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../logging/logging.service';
import { DatasetService } from '../dataset/dataset.service';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import axios from 'axios';

@Injectable()
export class WeatherJobService {
  private readonly logger = new Logger(WeatherJobService.name);

  constructor(
    private config: ConfigService,
    private logging: LoggingService,
    private dataset: DatasetService,
  ) {}

  async runWeatherFetch(dryRun = false): Promise<any> {
    const log = this.logging.createLog('weather', dryRun);
    const python = this.config.get('python.executable');
    const script = this.config.get('python.weatherScript');
    const csvPath = this.config.get('paths.weatherCsv');
    const apiKey = this.config.get('api.visualCrossingKey');
    const timeout = this.config.get('python.timeout');

    const args = [`--csv-path`, csvPath];
    if (dryRun) args.push('--dry-run');
    const env = { ...process.env, VISUAL_CROSSING_API_KEY: apiKey };

    try {
      const output = await this.spawnPython(python, script, args, env, timeout);
      const resultLine = output.split('\n').find(l => l.startsWith('RESULT_JSON:'));
      if (!resultLine) throw new Error('No RESULT_JSON in output');
      const result = JSON.parse(resultLine.replace('RESULT_JSON:', ''));
      if (!dryRun) {
        await this.dataset.importWeatherCsv();
        await this.dataset.exportMlCsvs();
      }
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
      await this.dataset.exportMlCsvs();
      const mlUrl = this.config.get<string>('ml.serviceUrl');
      const response = await axios.post(`${mlUrl}/predict`, { dryRun });
      const result = response.data;
      this.logging.finalizeLog(log, result.success ?? true, result);
      return result;
    } catch (err) {
      this.logging.finalizeLog(log, false, null, err.message);
      throw err;
    }
  }

  private spawnPython(
    python: string,
    script: string,
    args: string[],
    env: any,
    timeout: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const scriptPath = path.resolve(process.cwd(), script);
      this.logger.log(`Spawning: ${python} ${scriptPath} ${args.join(' ')}`);
      const proc = spawn(python, [scriptPath, ...args], { env });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        proc.kill();
        reject(new Error(`Script timed out after ${timeout}ms`));
      }, timeout);
      proc.stdout.on('data', d => { stdout += d.toString(); });
      proc.stderr.on('data', d => {
        stderr += d.toString();
        this.logger.debug(`[Python] ${d.toString().trim()}`);
      });
      proc.on('close', code => {
        clearTimeout(timer);
        if (code !== 0 && !stdout.includes('RESULT_JSON:') && !stdout.includes('PREDICTION_RESULT:')) {
          reject(new Error(`Script exited with code ${code}: ${stderr}`));
        } else {
          resolve(stdout);
        }
      });
      proc.on('error', err => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  getWeatherData(week?: number, year?: number): any[] {
    const csvPath = this.config.get('paths.weatherCsv');
    return this.readCsv(csvPath, row => {
      if (week && parseInt(row.week) !== week) return false;
      if (year && parseInt(row.year) !== year) return false;
      return true;
    });
  }

  getPredictions(week?: number, year?: number): any[] {
    const csvPath = this.config.get('paths.predictionCsv');
    if (!fs.existsSync(csvPath)) return [];
    return this.readCsv(csvPath, row => {
      if (week && parseInt(row.predicted_week) !== week) return false;
      if (year && parseInt(row.predicted_year) !== year) return false;
      return true;
    });
  }

  getLatestPredictions(): any[] {
    const all = this.getPredictions();
    if (!all.length) return [];
    const maxWeek = Math.max(...all.map(r => parseInt(r.predicted_week) || 0));
    const maxYear = Math.max(
      ...all.filter(r => parseInt(r.predicted_week) === maxWeek).map(r => parseInt(r.predicted_year) || 0)
    );
    return all.filter(r =>
      parseInt(r.predicted_week) === maxWeek && parseInt(r.predicted_year) === maxYear
    );
  }

  getDengueCounts(): any[] {
    const csvPath = this.config.get('paths.dengueCsv');
    if (!fs.existsSync(csvPath)) return [];
    return this.readCsv(csvPath);
  }

  saveDengueCounts(rows: any[]): void {
    const csvPath = this.config.get('paths.dengueCsv');
    const dir = path.dirname(csvPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

    const existing = fs.existsSync(csvPath) ? this.readCsv(csvPath) : [];

    // Upsert: replace existing rows for same district+week+year
    const newKeys = new Set(rows.map(r => `${r.district}_${r.week}_${r.year}`));
    const merged = existing
      .filter(r => !newKeys.has(`${r.district}_${r.week}_${r.year}`))
      .concat(rows);

    merged.sort((a, b) => {
      const yearDiff = parseInt(a.year) - parseInt(b.year);
      if (yearDiff !== 0) return yearDiff;
      return parseInt(a.week) - parseInt(b.week);
    });

    const headers = ['district', 'week', 'year', 'cases'];
    const lines = [headers.join(',')];
    for (const row of merged) {
      lines.push(headers.map(h => row[h] ?? '').join(','));
    }
    fs.writeFileSync(csvPath, lines.join('\n') + '\n');
  }

  async getWeatherStats(): Promise<any> {
    return this.dataset.getWeatherStats();
  }

  private readCsv(csvPath: string, filter?: (row: any) => boolean): any[] {
    if (!fs.existsSync(csvPath)) return [];
    try {
      const content = fs.readFileSync(csvPath, 'utf-8').trim();
      if (!content) return [];
      const lines = content.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const rows = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = lines[i].split(',');
        const row: any = {};
        headers.forEach((h, idx) => row[h] = values[idx]?.trim() ?? '');
        if (!filter || filter(row)) rows.push(row);
      }
      return rows;
    } catch {
      return [];
    }
  }
}
