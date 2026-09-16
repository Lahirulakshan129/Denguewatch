import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';

export interface JobLog {
  id: string;
  type: 'weather' | 'prediction' | 'dengue_upload';
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt?: string;
  durationMs?: number;
  dryRun: boolean;
  result?: any;
  error?: string;
}

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private logsPath: string;

  constructor(private config: ConfigService) {
    this.logsPath = this.config.get('paths.logsPath');
    try {
      const dir = path.dirname(this.logsPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (err: any) {
      this.logger.warn(`Could not create logs directory: ${err.message}`);
    }
  }

  getLogs(limit = 50): JobLog[] {
    if (!fs.existsSync(this.logsPath)) return [];
    try {
      const raw = fs.readFileSync(this.logsPath, 'utf-8');
      const logs: JobLog[] = JSON.parse(raw);
      return logs.slice(-limit).reverse();
    } catch {
      return [];
    }
  }

  appendLog(log: JobLog): void {
    try {
      const logs = this.getLogs(500).reverse();
      logs.push(log);
      fs.writeFileSync(this.logsPath, JSON.stringify(logs.slice(-500), null, 2));
    } catch (err: any) {
      this.logger.warn(`Could not append log: ${err.message}`);
    }
  }

  createLog(type: JobLog['type'], dryRun: boolean): JobLog {
    const log: JobLog = {
      id: `${type}_${Date.now()}`,
      type,
      status: 'running',
      startedAt: new Date().toISOString(),
      dryRun,
    };
    this.appendLog(log);
    return log;
  }

  finalizeLog(log: JobLog, success: boolean, result?: any, error?: string): JobLog {
    const finished = new Date();
    const started = new Date(log.startedAt);
    log.status = success ? 'success' : 'failed';
    log.finishedAt = finished.toISOString();
    log.durationMs = finished.getTime() - started.getTime();
    if (result) log.result = result;
    if (error) log.error = error;
    try {
      const allLogs = this.getLogs(500).reverse();
      const idx = allLogs.findIndex((l) => l.id === log.id);
      if (idx >= 0) allLogs[idx] = log;
      else allLogs.push(log);
      fs.writeFileSync(this.logsPath, JSON.stringify(allLogs.slice(-500), null, 2));
    } catch (err: any) {
      this.logger.warn(`Could not finalize log: ${err.message}`);
    }
    return log;
  }
}
