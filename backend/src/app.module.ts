import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { LoggingModule } from './logging/logging.module';
import { WeatherJobModule } from './weather-job/weather-job.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { WeatherModule } from './weather/weather.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { DatasetModule } from './dataset/dataset.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('database.host'),
        port: config.get('database.port'),
        username: config.get('database.username'),
        password: config.get('database.password'),
        database: config.get('database.name'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: config.get('database.synchronize'),
      }),
    }),
    AuthModule,
    UsersModule,
    DatasetModule,
    ScheduleModule.forRoot(),
    LoggingModule,
    WeatherJobModule,
    SchedulerModule,
    WeatherModule,
  ],
})
export class AppModule {}
