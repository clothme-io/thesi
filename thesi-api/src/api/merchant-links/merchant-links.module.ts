import { MerchantLoginService } from './merchant-login.service';
import { MerchantLoginController, MerchantLoginInternalController, MerchantIdentityGuard } from './merchant-login.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { MerchantLinksService } from './merchant-links.service';
import { ProductCampaignService } from './product-campaign.service';
import { MerchantLinkInternalController, MerchantLinksController, MerchantServiceGuard } from './merchant-links.controller';

@Module({ imports: [AuthModule, CampaignsModule], controllers: [MerchantLoginController,MerchantLoginInternalController,MerchantLinkInternalController, MerchantLinksController], providers: [MerchantLoginService,MerchantIdentityGuard,MerchantLinksService, ProductCampaignService, MerchantServiceGuard] })
export class MerchantLinksModule {}
