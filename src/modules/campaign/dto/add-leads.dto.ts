import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CampaignLeadInputDto } from './create-campaign.dto';

export class AddCampaignLeadsDto {
  @ApiProperty({
    description: 'Additional leads/numbers to append to the campaign spreadsheet',
    type: [CampaignLeadInputDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampaignLeadInputDto)
  leads!: CampaignLeadInputDto[];
}
