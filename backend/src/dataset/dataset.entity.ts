import { Entity, Column, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity()
@Unique(['year', 'week', 'district'])
export class DatasetRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  year: number;

  @Column({ type: 'int' })
  week: number;

  @Column()
  district: string;

  @Column({ type: 'float', nullable: true })
  avg_temp: number;

  @Column({ type: 'float', nullable: true })
  avg_humidity: number;

  @Column({ type: 'float', nullable: true })
  total_rainfall: number;

  @Column({ type: 'float', nullable: true })
  avg_windspeed: number;

  @Column({ type: 'int', nullable: true })
  dengue_cases: number;
}
