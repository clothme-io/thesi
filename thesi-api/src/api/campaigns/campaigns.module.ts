import { CampaignFundingModule } from '../campaign-funding/campaign-funding.module';
import { CampaignProductsService } from './campaign-products.service';
import { ProductPreviewController } from './product-preview.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { BillingModule } from 'src/api/billing/billing.module';
import { ConnectModule } from 'src/api/connect/connect.module';
import { InboxModule } from 'src/api/inbox/inbox.module';
import { InvitesModule } from 'src/api/invites/invites.module';
import { MarketplaceModule } from 'src/api/marketplace/marketplace.module';
import { FILE_STORAGE } from 'src/shared/storage/file-storage.port';
import { ConfigurableFileStorage } from 'src/shared/storage/file-storage';
import { CAMPAIGN_REPOSITORY } from './campaign.repository';
import { CampaignContentReviewController } from './campaign-content-review.controller';
import {
  CAMPAIGN_CONTENT_REVIEW_REPOSITORY,
  PostgresCampaignContentReviewRepository,
} from './campaign-content-review.repository';
import { CampaignContentReviewService } from './campaign-content-review.service';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { PostgresCampaignRepository } from './postgres-campaign.repository';

@Module({
  imports: [
    CampaignFundingModule,
    AuthModule,
    MarketplaceModule,
    BillingModule,
    ConnectModule,
    InvitesModule,
    InboxModule,
  ],
  exports: [CampaignProductsService],
  controllers: [
    CampaignsController,
    CampaignContentReviewController,
    ProductPreviewController,
  ],
  providers: [
    CampaignsService,
    CampaignProductsService,
    CampaignContentReviewService,
    {
      provide: CAMPAIGN_REPOSITORY,
      useClass: PostgresCampaignRepository,
    },
    {
      provide: CAMPAIGN_CONTENT_REVIEW_REPOSITORY,
      useClass: PostgresCampaignContentReviewRepository,
    },
    {
      provide: FILE_STORAGE,
      useClass: ConfigurableFileStorage,
    },
  ],
})
export class CampaignsModule {}
