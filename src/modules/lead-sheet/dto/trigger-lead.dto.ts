import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsNumber, IsOptional, IsString, IsUrl } from 'class-validator';
import { ToStrictNumber } from '../../../common/utils/strict-boolean';

export class TriggerLeadDto {
  @ApiProperty({ description: 'WhatsApp session ID to send greeting from', example: 'default' })
  @IsString()
  @IsNotEmpty()
  sessionId!: string;

  @ApiProperty({ description: 'Lead phone number (E.164 or national digits)', example: '+15552345678' })
  @IsString()
  @IsNotEmpty()
  phone!: string;

  @ApiPropertyOptional({ description: 'Lead contact name', example: 'Alice Johnson' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    description: 'Custom greeting message template. Supports {{Name}} placeholder and {Hi|Hello} Spintax.',
    example: 'Hi {{Name}}! 👋 Thank you for reaching out to us. How can we help you today?',
  })
  @IsOptional()
  @IsString()
  greetingTemplate?: string;

  @ApiPropertyOptional({ description: 'Google Spreadsheet ID or Sheet Name', example: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms' })
  @IsOptional()
  @IsString()
  sheetId?: string;

  @ApiPropertyOptional({ description: 'Spreadsheet row number (1-based)', example: 5 })
  @IsOptional()
  @ToStrictNumber()
  @IsNumber()
  rowIndex?: number;

  @ApiPropertyOptional({
    description: 'Google Apps Script Webhook URL to call back when status updates (GREETING_SENT, REPLIED, OPT_OUT, W-RNR)',
    example: 'https://script.google.com/macros/s/AKfycbx.../exec',
  })
  @IsOptional()
  @IsString()
  sheetCallbackUrl?: string;
}

export class LeadTriggerResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  leadId?: string;

  @ApiPropertyOptional()
  chatId?: string;

  @ApiPropertyOptional()
  message?: string;
}
