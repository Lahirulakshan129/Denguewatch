import { Controller, Post, Get, UseGuards, UseInterceptors, UploadedFile, BadRequestException, Res } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UserRole } from '../users/user.entity';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DatasetRecord } from './dataset.entity';
import { DatasetService } from './dataset.service';
import { Response } from 'express';

@Controller('dataset')
export class DatasetController {
  constructor(
    @InjectRepository(DatasetRecord)
    private datasetRepo: Repository<DatasetRecord>,
    private dataset: DatasetService,
  ) {}

  @Post('migrate')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async migrateCsvs() {
    return this.dataset.importAllCsvs();
  }

  @Post('upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadCsv(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file uploaded');
    const text = file.buffer.toString('utf-8');
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Require the specific headers
    const required = ['year', 'week', 'district', 'avg_temp', 'avg_humidity', 'total_rainfall', 'avg_windspeed', 'dengue_cases'];
    
    // We can also accept slightly different names but for now let's map exactly or fallback
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      const vals = lines[i].split(',');
      const row: any = {};
      headers.forEach((h, idx) => {
        if (vals[idx] !== undefined) row[h] = vals[idx].trim();
      });

      if (!row.year || !row.week || !row.district) continue;

      const record = new DatasetRecord();
      record.year = parseInt(row.year);
      record.week = parseInt(row.week);
      record.district = row.district;
      record.avg_temp = row.avg_temp ? parseFloat(row.avg_temp) : null;
      record.avg_humidity = row.avg_humidity ? parseFloat(row.avg_humidity) : null;
      record.total_rainfall = (row.total_rainfall ?? row.total_precip) ? parseFloat(row.total_rainfall ?? row.total_precip) : null;
      record.avg_windspeed = row.avg_windspeed ? parseFloat(row.avg_windspeed) : null;
      record.dengue_cases = row.dengue_cases ? parseInt(row.dengue_cases) : null;
      record.max_temp = row.max_temp ? parseFloat(row.max_temp) : null;
      record.min_temp = row.min_temp ? parseFloat(row.min_temp) : null;
      record.rainy_days = row.rainy_days ? parseFloat(row.rainy_days) : null;
      record.population_density = row.population_density ? parseFloat(row.population_density) : null;
      record.district_id = row.district_id ? parseInt(row.district_id) : null;

      rows.push(record);
    }

    // Upsert the data (conflict on year, week, district)
    for (const r of rows) {
      await this.datasetRepo
        .createQueryBuilder()
        .insert()
        .into(DatasetRecord)
        .values(r)
        .orUpdate(
          [
            'avg_temp', 'avg_humidity', 'total_rainfall', 'avg_windspeed', 'dengue_cases',
            'max_temp', 'min_temp', 'rainy_days', 'population_density', 'district_id',
          ],
          ['year', 'week', 'district']
        )
        .execute();
    }

    await this.dataset.exportMlCsvs();
    return { success: true, count: rows.length };
  }

  @Get('download')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  async downloadCsv(@Res() res: Response) {
    return this.sendCsv(res, 'training_dataset.csv', await this.dataset.toTrainingCsv());
  }

  @Get('download/weather')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  async downloadWeather(@Res() res: Response) {
    return this.sendCsv(res, 'weather_weekly.csv', await this.dataset.toWeatherCsv());
  }

  @Get('download/predictions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.OFFICER)
  async downloadPredictions(@Res() res: Response) {
    return this.sendCsv(res, 'predictions.csv', await this.dataset.toPredictionsCsv());
  }

  private sendCsv(res: Response, filename: string, csvContent: string) {
    res.header('Content-Type', 'text/csv');
    res.attachment(filename);
    return res.send(csvContent);
  }
}
