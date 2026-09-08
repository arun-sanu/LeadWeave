import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Res,
  Header,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { CampaignService } from './campaign.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { AddCampaignLeadsDto } from './dto/add-leads.dto';
import { UpdateCampaignLeadDto } from './dto/update-lead.dto';
import { CampaignLeadsQueryDto, CampaignListQueryDto } from './dto/campaign-query.dto';
import { RequireUnscopedKey, CurrentApiKey } from '../auth/decorators/auth.decorators';
import { ApiKey } from '../auth/entities/api-key.entity';

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Create a new campaign with spreadsheet leads and optional schedule' })
  async createCampaign(@Body() dto: CreateCampaignDto, @CurrentApiKey() _apiKey?: ApiKey) {
    return this.campaignService.createCampaign(dto);
  }

  @Get()
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'List all campaigns with summary stats' })
  async listCampaigns(@Query() query: CampaignListQueryDto, @CurrentApiKey() _apiKey?: ApiKey) {
    return this.campaignService.listCampaigns(query);
  }

  @Get(':id')
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Get campaign details and stats' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  async getCampaign(@Param('id') id: string, @CurrentApiKey() _apiKey?: ApiKey) {
    return this.campaignService.getCampaign(id);
  }

  @Post(':id/start')
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Start or resume campaign dispatch' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  async startCampaign(@Param('id') id: string, @CurrentApiKey() _apiKey?: ApiKey) {
    return this.campaignService.startCampaign(id);
  }

  @Post(':id/pause')
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Pause campaign dispatch' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  async pauseCampaign(@Param('id') id: string, @CurrentApiKey() _apiKey?: ApiKey) {
    return this.campaignService.pauseCampaign(id);
  }

  @Post(':id/cancel')
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Cancel campaign' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  async cancelCampaign(@Param('id') id: string, @CurrentApiKey() _apiKey?: ApiKey) {
    return this.campaignService.cancelCampaign(id);
  }

  @Post(':id/leads')
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Dynamically add more numbers/leads to an existing campaign' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  async addLeads(
    @Param('id') id: string,
    @Body() dto: AddCampaignLeadsDto,
    @CurrentApiKey() _apiKey?: ApiKey,
  ) {
    return this.campaignService.addLeads(id, dto);
  }

  @Post(':id/leads/:leadId')
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Update an existing campaign lead (e.g., from spreadsheet)' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @ApiParam({ name: 'leadId', description: 'Lead UUID' })
  async updateLead(
    @Param('id') id: string,
    @Param('leadId') leadId: string,
    @Body() dto: UpdateCampaignLeadDto,
    @CurrentApiKey() _apiKey?: ApiKey,
  ) {
    return this.campaignService.updateLead(id, leadId, dto);
  }

  @Get(':id/leads')
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Get spreadsheet rows for a campaign with search and status filters' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  async listLeads(
    @Param('id') id: string,
    @Query() query: CampaignLeadsQueryDto,
    @CurrentApiKey() _apiKey?: ApiKey,
  ) {
    return this.campaignService.listLeads(id, query);
  }

  @Get(':id/analytics')
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Get detailed funnel, timeline, and conversion analytics for a campaign' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  async getAnalytics(@Param('id') id: string, @CurrentApiKey() _apiKey?: ApiKey) {
    return this.campaignService.getCampaignAnalytics(id);
  }

  @Get(':id/export')
  @RequireUnscopedKey()
  @ApiOperation({ summary: 'Export campaign spreadsheet with delivery and response data as CSV' })
  @ApiParam({ name: 'id', description: 'Campaign UUID' })
  @Header('Content-Type', 'text/csv')
  async exportCsv(
    @Param('id') id: string,
    @Res() res: Response,
    @CurrentApiKey() _apiKey?: ApiKey,
  ) {
    res.setHeader('Content-Disposition', `attachment; filename="campaign-${id}-export.csv"`);
    res.status(HttpStatus.OK);
    await this.campaignService.exportCampaignCsv(id, res);
  }
}
