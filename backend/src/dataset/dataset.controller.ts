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
      record.total_rainfall = row.total_rainfall ? parseFloat(row.total_rainfall) : null;
      record.avg_windspeed = row.avg_windspeed ? parseFloat(row.avg_windspeed) : null;
      record.dengue_cases = row.dengue_cases ? parseInt(row.dengue_cases) : null;

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
          ['avg_temp', 'avg_humidity', 'total_rainfall', 'avg_windspeed', 'dengue_cases'],
          ['year', 'week', 'district']
        )
        .execute();
    }

    await this.dataset.exportMlCsvs();
    return { success: true, count: rows.length };
  }

  @Get('download')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async downloadCsv(@Res() res: Response) {
    const data = await this.datasetRepo.find({ order: { year: 'ASC', week: 'ASC', district: 'ASC' } });
    
    const headers = ['Year', 'Week', 'District', 'Avg_Temp', 'Avg_Humidity', 'Total_Rainfall', 'Avg_Windspeed', 'Dengue_Cases'];
    const lines = [headers.join(',')];
    
    for (const r of data) {
      lines.push([
        r.year,
        r.week,
        r.district,
        r.avg_temp ?? '',
        r.avg_humidity ?? '',
        r.total_rainfall ?? '',
        r.avg_windspeed ?? '',
        r.dengue_cases ?? ''
      ].join(','));
    }

    const csvContent = lines.join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment('training_dataset.csv');
    return res.send(csvContent);
  }
}
