import { Module } from '@nestjs/common';
import { WeatherJobService } from './weather-job.service';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [LoggingModule],
  providers: [WeatherJobService],
  exports: [WeatherJobService],
})
export class WeatherJobModule {}