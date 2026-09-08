import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { DateTransformer } from '../../../common/transformers/date.transformer';
import { jsonColumnType, dateColumnType } from '../../../common/utils/column-types';

export enum CampaignLeadStatus {
  PENDING = 'PENDING',
  NOT_ON_WA = 'NOT_ON_WA',
  SENT = 'SENT',
  DELIVERED = 'DELIVERED',
  READ = 'READ',
  REPLIED = 'REPLIED',
  OPT_OUT = 'OPT_OUT',
  FAILED = 'FAILED',
}

@Entity('campaign_leads')
@Index('IDX_campaign_leads_campaign_status', ['campaignId', 'status'])
@Index('IDX_campaign_leads_session_chat', ['sessionId', 'chatId'])
@Index('IDX_campaign_leads_chat_status', ['chatId', 'status'])
@Index('IDX_campaign_leads_waMessageId', ['waMessageId'])
export class CampaignLead {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'campaign_id' })
  campaignId!: string;

  @Column({ name: 'session_id' })
  sessionId!: string;

  @Column({ name: 'phone_number' })
  phoneNumber!: string;

  @Column({ name: 'chat_id' })
  chatId!: string;

  @Column({ nullable: true })
  name?: string;

  @Column({ name: 'custom_variables', type: jsonColumnType(), default: () => "'{}'" })
  customVariables!: Record<string, string>;

  @Column({ type: 'varchar', default: CampaignLeadStatus.PENDING })
  status!: CampaignLeadStatus;

  @Column({ name: 'wa_message_id', nullable: true })
  waMessageId?: string;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage?: string;

  @Column({ name: 'sent_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  sentAt?: Date | null;

  @Column({ name: 'delivered_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  deliveredAt?: Date | null;

  @Column({ name: 'read_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  readAt?: Date | null;

  @Column({ name: 'replied_at', type: dateColumnType(), nullable: true, transformer: DateTransformer })
  repliedAt?: Date | null;

  @Column({ name: 'first_reply_snippet', type: 'text', nullable: true })
  firstReplySnippet?: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
