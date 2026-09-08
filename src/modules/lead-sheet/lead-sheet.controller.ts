import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import type { Request } from 'express';
import { LeadSheetService } from './lead-sheet.service';
import { TriggerLeadDto, LeadTriggerResponseDto } from './dto/trigger-lead.dto';
import { Public, RequireUnscopedKey, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKey } from '../auth/entities/api-key.entity';

@ApiTags('lead-sheets')
@Controller('lead-sheets')
export class LeadSheetController {
  constructor(private readonly leadSheetService: LeadSheetService) {}

  @Post('trigger-lead')
  @Public()
  @ApiOperation({ summary: 'Trigger lead verification & auto-greeting from Google Sheets or LeadWeave UI' })
  @ApiResponse({ status: 200, type: LeadTriggerResponseDto })
  async triggerLead(@Body() dto: TriggerLeadDto): Promise<LeadTriggerResponseDto> {
    return this.leadSheetService.processLeadTrigger(dto);
  }

  @Get('leads')
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Get tracked CRM leads list with live status and timestamps' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Filter by session ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max leads to return (default 100)' })
  async getLeads(
    @CurrentApiKey() _apiKey?: ApiKey,
    @Query('sessionId') sessionId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.leadSheetService.listLeads(sessionId, limit ? parseInt(limit, 10) : 100);
  }

  @Get('apps-script-template')
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Get ready-to-paste Google Apps Script code for spreadsheet integration' })
  @ApiQuery({ name: 'sessionId', required: false, description: 'Default session ID to use' })
  @ApiQuery({ name: 'baseUrl', required: false, description: 'Server base URL' })
  getAppsScript(
    @Req() req: Request,
    @CurrentApiKey() _apiKey?: ApiKey,
    @Query('sessionId') sessionId = 'default',
    @Query('baseUrl') baseUrl?: string,
  ): { script: string } {
    const host = baseUrl || `${req.protocol}://${req.get('host')}`;
    const script = this.leadSheetService.getAppsScriptTemplate(host, sessionId);
    return { script };
  }
}
