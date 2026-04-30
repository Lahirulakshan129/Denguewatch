import { Module } from '@nestjs/common';
import { WeatherController } from './weather.controller';
import { WeatherJobModule } from '../weather-job/weather-job.module';
import { LoggingModule } from '../logging/logging.module';

@Module({
  imports: [WeatherJobModule, LoggingModule],
  controllers: [WeatherController],
})
export class WeatherModule {}