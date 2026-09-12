import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Campaign } from './entities/campaign.entity';
import { CampaignLead } from './entities/campaign-lead.entity';
import { CampaignService } from './campaign.service';
import { CampaignLeadService } from './campaign-lead.service';
import { CampaignController } from './campaign.controller';
import { EngineModule } from '../../engine/engine.module';
import { HooksModule } from '../../core/hooks/hooks.module';
import { MessageModule } from '../message/message.module';

@Module({
  imports: [TypeOrmModule.forFeature([Campaign, CampaignLead], 'data'), EngineModule, HooksModule, MessageModule],
  controllers: [CampaignController],
  providers: [CampaignService, CampaignLeadService],
  exports: [CampaignService, CampaignLeadService],
})
export class CampaignModule {}
