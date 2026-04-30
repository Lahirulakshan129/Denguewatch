import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { WeatherJobService } from '../weather-job/weather-job.service';

@Injectable()
export class SchedulerService {

  constructor(private readonly jobService: WeatherJobService) {}

  @Cron('0 0 * * 0') // Sunday midnight
  async handleCron() {
    console.log('Running scheduled ML pipeline...');
    await this.jobService.runPipeline();
  }
}