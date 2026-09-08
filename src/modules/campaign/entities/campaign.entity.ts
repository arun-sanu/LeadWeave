import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DateTransformer } from '../../../common/transformers/date.transformer';
import { jsonColumnType, dateColumnType } from '../../../common/utils/column-types';

export enum CampaignStatus {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

export interface CampaignStats {
  total: number;
  pending: number;
  sent: number;
  delivered: number;
  read: number;
  replied: number;
  optOut: number;
  failed: number;
  responseRate: number; // percentage 0-100
}

export interface CampaignPacingConfig {
  minDelayMs: number;
  maxDelayMs: number;
  simulateTyping: boolean;
}

@Entity('campaigns')
@Index('IDX_campaigns_status_scheduledAt', ['status', 'scheduledAt'])
export class Campaign {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ name: 'company_id', type: 'varchar', length: 100, nullable: true })
  companyId?: string | null;

  @Column({ name: 'session_ids', type: jsonColumnType() })
  sessionIds!: string[];

  @Column({ type: 'varchar', default: CampaignStatus.DRAFT })
  status!: CampaignStatus;

  @Column({ type: 'text' })
  template!: string;

  @Column({ name: 'media_url', type: 'varchar', nullable: true })
  mediaUrl?: string | null;

  @Column({ name: 'scheduled_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  scheduledAt?: Date | null;

  @Column({ type: jsonColumnType(), nullable: true })
  pacing!: CampaignPacingConfig;

  @Column({ type: jsonColumnType(), default: () => "'{}'" })
  stats!: CampaignStats;

  @Column({ name: 'columns_metadata', type: jsonColumnType(), nullable: true })
  columnsMetadata?: string[];

  @Column({ name: 'started_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  startedAt?: Date | null;

  @Column({ name: 'completed_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  completedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
