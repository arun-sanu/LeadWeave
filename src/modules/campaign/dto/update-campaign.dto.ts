import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignPacingDto } from './create-campaign.dto';

export class UpdateCampaignDto {
  @ApiPropertyOptional({ description: 'Campaign Name' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'List of session IDs for load balancing / sending', type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sessionIds?: string[];

  @ApiPropertyOptional({ description: 'Message template with spintax and {{variable}} tags' })
  @IsOptional()
  @IsString()
  template?: string;

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

  @ApiPropertyOptional({
    description: 'Dispatch mode: automated or manual (1-by-1)',
    enum: ['automated', 'manual'],
  })
  @IsOptional()
  @IsIn(['automated', 'manual'])
  dispatchMode?: 'automated' | 'manual';
}
