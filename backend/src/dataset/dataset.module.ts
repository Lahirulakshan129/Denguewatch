import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatasetController } from './dataset.controller';
import { DatasetRecord } from './dataset.entity';
import { DatasetService } from './dataset.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [TypeOrmModule.forFeature([DatasetRecord]), AuthModule],
  controllers: [DatasetController],
  providers: [DatasetService],
  exports: [TypeOrmModule, DatasetService],
})
export class DatasetModule {}
