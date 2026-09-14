import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { BillingModule } from '../billing/billing.module';
import { ConnectModule } from '../connect/connect.module';
import { CampaignFundingService } from './campaign-funding.service';
import { CampaignFundingController } from './campaign-funding.controller';
import { FundingGateway } from './funding.gateway';
@Module({
  imports: [AuthModule, BillingModule, ConnectModule],
  controllers: [CampaignFundingController],
  providers: [CampaignFundingService, FundingGateway],
  exports: [CampaignFundingService],
})
export class CampaignFundingModule {}
