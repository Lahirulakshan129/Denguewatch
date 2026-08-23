import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WeatherJobService } from '../weather-job/weather-job.service';

@Injectable()
export class SchedulerService {
  private readonly logger = new Logger(SchedulerService.name);
  private nextRun: Date | null = null;

  constructor(private weatherJob: WeatherJobService) {
    this.updateNextRun();
  }

  // Every Sunday at midnight
  @Cron('0 0 0 * * 0')
  async runWeeklyJob() {
    this.logger.log('Sunday cron: running weekly weather fetch + prediction');
    try {
      await this.weatherJob.runWeatherFetch(false);
      this.logger.log('Weather fetch complete. Starting prediction...');
      await this.weatherJob.runPrediction(false);
      this.logger.log('Weekly ML prediction complete.');
    } catch (err) {
      this.logger.error('Weekly job failed:', err.message);
    }
    this.updateNextRun();
  }

  private updateNextRun() {
    const now = new Date();
    const next = new Date(now);
    const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    next.setDate(now.getDate() + daysUntilSunday);
    next.setHours(0, 0, 0, 0);
    this.nextRun = next;
  }

  getNextRun(): Date | null {
    return this.nextRun;
  }
}
