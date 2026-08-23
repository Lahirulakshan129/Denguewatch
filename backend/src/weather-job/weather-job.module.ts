import { Module } from '@nestjs/common';
import { WeatherJobService } from './weather-job.service';
import { LoggingModule } from '../logging/logging.module';
import { DatasetModule } from '../dataset/dataset.module';

@Module({
  imports: [LoggingModule, DatasetModule],
  providers: [WeatherJobService],
  exports: [WeatherJobService],
})
export class WeatherJobModule {}
