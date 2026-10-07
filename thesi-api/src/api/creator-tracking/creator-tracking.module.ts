import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CampaignsModule } from '../campaigns/campaigns.module';
import { AttributionServiceGuard, CreatorAttributionController, CreatorTrackingController } from './creator-tracking.controller';
import { CreatorTrackingService } from './creator-tracking.service';
@Module({
  imports: [AuthModule, forwardRef(() => CampaignsModule)],
  controllers: [CreatorTrackingController, CreatorAttributionController],
  providers: [CreatorTrackingService, AttributionServiceGuard],
  exports: [CreatorTrackingService],
})
export class CreatorTrackingModule {}
