import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AttributionServiceGuard, CreatorAttributionController, CreatorTrackingController } from './creator-tracking.controller';
import { CreatorTrackingService } from './creator-tracking.service';
@Module({ imports: [AuthModule, CampaignsModule], controllers: [CreatorTrackingController, CreatorAttributionController], providers: [CreatorTrackingService, AttributionServiceGuard] })
export class CreatorTrackingModule {}
