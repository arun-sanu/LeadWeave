import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsObject } from 'class-validator';

export class UpdateCampaignLeadDto {
  @ApiPropertyOptional({ description: 'Updated name of the lead' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ description: 'Updated custom variables JSON object' })
  @IsOptional()
  @IsObject()
  customVariables?: Record<string, string>;
}
