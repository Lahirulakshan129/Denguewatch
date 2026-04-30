import { Module } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { WeatherJobModule } from '../weather-job/weather-job.module';

@Module({
  imports: [WeatherJobModule],
  providers: [SchedulerService],
})
export class SchedulerModule {}