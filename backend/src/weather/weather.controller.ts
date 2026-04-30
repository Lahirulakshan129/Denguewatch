import { Controller, Post, Get, Query } from '@nestjs/common';
import { WeatherJobService } from '../weather-job/weather-job.service';
import { LoggingService } from '../logging/logging.service';
import * as fs from 'fs';

@Controller('weather')
export class WeatherController {

  constructor(
    private readonly jobService: WeatherJobService,
    private readonly logger: LoggingService
  ) {}

  @Post('trigger')
  async triggerJob() {
    await this.jobService.runPipeline();
    return { message: 'Pipeline executed successfully' };
  }

  @Get('logs')
  getLogs(@Query('limit') limit = 20) {
    return this.logger.getLogs(Number(limit));
  }

  @Get('data')
  getWeatherData() {
    if (!fs.existsSync('./data/weekly_weather.csv')) {
      return [];
    }

    return fs.readFileSync('./data/weekly_weather.csv', 'utf-8');
  }

  @Get('predictions')
  getPredictions() {
    if (!fs.existsSync('./data/predictions.csv')) {
      return [];
    }

    return fs.readFileSync('./data/predictions.csv', 'utf-8');
  }
}