import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ToStrictNumber } from '../../../common/utils/strict-boolean';
import { CampaignLeadStatus } from '../entities/campaign-lead.entity';
import { CampaignStatus } from '../entities/campaign.entity';

export class CampaignListQueryDto {
  @ApiPropertyOptional({ enum: CampaignStatus })
  @IsOptional()
  @IsEnum(CampaignStatus)
  status?: CampaignStatus;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 20;
}

export class CampaignLeadsQueryDto {
  @ApiPropertyOptional({ enum: CampaignLeadStatus, description: 'Filter by lead status' })
  @IsOptional()
  @IsEnum(CampaignLeadStatus)
  status?: CampaignLeadStatus;

  @ApiPropertyOptional({ description: 'Search term for phone number, name, or reply snippet' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @ToStrictNumber()
  @Type(() => Number)
  @IsNumber()
  limit?: number = 50;
}
