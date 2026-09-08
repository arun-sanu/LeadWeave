import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeadRecord } from './entities/lead-record.entity';
import { LeadSheetService } from './lead-sheet.service';
import { LeadSheetController } from './lead-sheet.controller';
import { ContactModule } from '../contact/contact.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LeadRecord], 'data'),
    ContactModule,
  ],
  controllers: [LeadSheetController],
  providers: [LeadSheetService],
  exports: [LeadSheetService],
})
export class LeadSheetModule {}
