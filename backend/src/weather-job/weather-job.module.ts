import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WeatherJobService } from './weather-job.service';
import { LoggingModule } from '../logging/logging.module';
import { DatasetModule } from '../dataset/dataset.module';
import { DatasetRecord } from '../dataset/dataset.entity';
import { PredictionRecord } from '../prediction/prediction.entity';

@Module({
  imports: [
    LoggingModule,
    DatasetModule,
    TypeOrmModule.forFeature([DatasetRecord, PredictionRecord]),
  ],
  providers: [WeatherJobService],
  exports: [WeatherJobService],
})
export class WeatherJobModule {}
