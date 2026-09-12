import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ToStrictBoolean, ToStrictNumber } from '../../../common/utils/strict-boolean';

export class CampaignPacingDto {
  @ApiPropertyOptional({ default: 3000, description: 'Minimum delay in milliseconds between messages' })
  @IsOptional()
  @ToStrictNumber()
  @IsNumber()
  minDelayMs?: number = 3000;

  @ApiPropertyOptional({ default: 6000, description: 'Maximum delay in milliseconds between messages' })
  @IsOptional()
  @ToStrictNumber()
  @IsNumber()
  maxDelayMs?: number = 6000;

  @ApiPropertyOptional({ default: true, description: 'Whether to simulate human typing before sending' })
  @IsOptional()
  @ToStrictBoolean()
  @IsBoolean()
  simulateTyping?: boolean = true;

  @ApiPropertyOptional({
    default: 12000,
    description: 'Batch breather minimum pause in milliseconds (every 10 messages)',
  })
  @IsOptional()
  @ToStrictNumber()
  @IsNumber()
  breatherMinMs?: number = 12000;

  @ApiPropertyOptional({
    default: 25000,
    description: 'Batch breather maximum pause in milliseconds (every 10 messages)',
  })
  @IsOptional()
  @ToStrictNumber()
  @IsNumber()
  breatherMaxMs?: number = 25000;
}

export class CampaignLeadInputDto {
  @ApiProperty({ description: 'Phone number in international format e.g. +1234567890' })
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ description: 'Contact name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Custom variables for template placeholder replacement' })
  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}

export class CreateCampaignDto {
  @ApiProperty({ description: 'Campaign Name' })
  @IsString()
  name!: string;

  @ApiProperty({ description: 'List of session IDs for load balancing / sending', type: [String] })
  @IsArray()
  @IsString({ each: true })
  sessionIds!: string[];

  @ApiProperty({ description: 'Message template with spintax and {{variable}} tags' })
  @IsString()
  template!: string;

  @ApiPropertyOptional({ description: 'Optional media URL for image/video/document' })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({ description: 'Scheduled ISO date-time string if scheduling for later' })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({ type: CampaignPacingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampaignPacingDto)
  pacing?: CampaignPacingDto;

  @ApiPropertyOptional({ description: 'Metadata for spreadsheet column names', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  columnsMetadata?: string[];

  @ApiProperty({ description: 'Initial spreadsheet leads/numbers list', type: [CampaignLeadInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignLeadInputDto)
  leads!: CampaignLeadInputDto[];

  @ApiPropertyOptional({ description: 'Auto-launch immediately after creation', default: false })
  @IsOptional()
  @ToStrictBoolean()
  @IsBoolean()
  autoLaunch?: boolean;

  @ApiPropertyOptional({
    description: 'Dispatch mode: automated (background pacing) or manual (1-by-1 spreadsheet send)',
    enum: ['automated', 'manual'],
    default: 'automated',
  })
  @IsOptional()
  @IsIn(['automated', 'manual'])
  dispatchMode?: 'automated' | 'manual' = 'automated';
}
