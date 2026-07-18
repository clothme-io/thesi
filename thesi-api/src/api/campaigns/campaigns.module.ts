import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { BillingModule } from 'src/api/billing/billing.module';
import { ConnectModule } from 'src/api/connect/connect.module';
import { MarketplaceModule } from 'src/api/marketplace/marketplace.module';
import { FILE_STORAGE } from 'src/shared/storage/file-storage.port';
import { ConfigurableFileStorage } from 'src/shared/storage/file-storage';
import { CAMPAIGN_REPOSITORY } from './campaign.repository';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PostgresCampaignRepository } from './postgres-campaign.repository';

@Module({
  imports: [AuthModule, MarketplaceModule, BillingModule, ConnectModule],
  controllers: [CampaignsController],
  providers: [
    CampaignsService,
    {
      provide: CAMPAIGN_REPOSITORY,
      useClass: PostgresCampaignRepository,
    },
    {
      provide: FILE_STORAGE,
      useClass: ConfigurableFileStorage,
    },
  ],
})
export class CampaignsModule {}
