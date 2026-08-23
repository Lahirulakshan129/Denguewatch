import { Module } from '@nestjs/common';
import { WeatherController } from './weather.controller';
import { WeatherJobModule } from '../weather-job/weather-job.module';
import { LoggingModule } from '../logging/logging.module';
import { SchedulerModule } from '../scheduler/scheduler.module';
import { DatasetModule } from '../dataset/dataset.module';

@Module({
  imports: [WeatherJobModule, LoggingModule, SchedulerModule, DatasetModule],
  controllers: [WeatherController],
})
export class WeatherModule {}
