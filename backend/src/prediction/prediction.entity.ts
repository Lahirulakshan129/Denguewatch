import { Entity, Column, PrimaryGeneratedColumn, Unique, CreateDateColumn } from 'typeorm';

@Entity()
@Unique(['predicted_year', 'predicted_week', 'district'])
export class PredictionRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  district: string;

  @Column({ type: 'int' })
  predicted_year: number;

  @Column({ type: 'int' })
  predicted_week: number;

  @Column({ type: 'int' })
  predicted_cases: number;

  @Column({ type: 'int', nullable: true })
  confidence_low: number;

  @Column({ type: 'int', nullable: true })
  confidence_high: number;

  @Column({ default: false })
  fallback: boolean;

  @CreateDateColumn()
  generatedAt: Date;
}
