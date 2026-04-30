import { Injectable } from '@nestjs/common';
import * as fs from 'fs';

@Injectable()
export class LoggingService {

  private logFile = './logs/job-history.json';

  log(entry: any) {
    let logs = [];

    if (fs.existsSync(this.logFile)) {
      const file = fs.readFileSync(this.logFile, 'utf-8');
      logs = JSON.parse(file || '[]');
    }

    logs.push({
      ...entry,
      timestamp: new Date().toISOString(),
    });

    fs.writeFileSync(this.logFile, JSON.stringify(logs, null, 2));
  }

  getLogs(limit = 20) {
    if (!fs.existsSync(this.logFile)) return [];

    const logs = JSON.parse(fs.readFileSync(this.logFile, 'utf-8'));
    return logs.slice(-limit).reverse();
  }
}