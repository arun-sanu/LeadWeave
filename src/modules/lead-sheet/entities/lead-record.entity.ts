import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DateTransformer } from '../../../common/transformers/date.transformer';
import { dateColumnType } from '../../../common/utils/column-types';

export enum LeadStatus {
  PENDING = 'PENDING',
  NOT_ON_WA = 'NOT_ON_WA',
  GREETING_SENT = 'GREETING_SENT',
  REPLIED = 'REPLIED',
  OPT_OUT = 'OPT_OUT',
  W_RNR = 'W-RNR',
}

@Entity('lead_records')
@Index('IDX_lead_records_session_chat', ['sessionId', 'chatId'])
@Index('IDX_lead_records_status_timeout', ['status', 'timeoutAt'])
export class LeadRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'session_id' })
  sessionId!: string;

  @Column({ name: 'company_id', type: 'varchar', length: 100, nullable: true })
  companyId?: string | null;

  @Column({ name: 'chat_id' })
  chatId!: string;

  @Column({ name: 'phone_number' })
  phoneNumber!: string;

  @Column({ name: 'lead_name', nullable: true })
  leadName?: string;

  @Column({ name: 'sheet_id', nullable: true })
  sheetId?: string;

  @Column({ name: 'row_index', type: 'int', nullable: true })
  rowIndex?: number;

  @Column({ name: 'sheet_callback_url', nullable: true })
  sheetCallbackUrl?: string;

  @Column({ type: 'varchar', default: LeadStatus.PENDING })
  status!: LeadStatus;

  @Column({ name: 'greeting_message', type: 'text', nullable: true })
  greetingMessage?: string;

  @Column({ name: 'last_sent_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  lastSentAt?: Date | null;

  @Column({ name: 'replied_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  repliedAt?: Date | null;

  @Column({ name: 'timeout_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  timeoutAt?: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
