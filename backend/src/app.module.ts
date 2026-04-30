import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ConfigModule } from '@nestjs/config';

import configuration from './config/configuration';
import { SchedulerModule } from './scheduler/scheduler.module';
import { WeatherJobModule } from './weather-job/weather-job.module';
import { LoggingModule } from './logging/logging.module';
import { WeatherModule } from './weather/weather.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
    }),
    ScheduleModule.forRoot(),
    SchedulerModule,
    WeatherJobModule,
    LoggingModule,
    WeatherModule,
  ],
})
export class AppModule {}