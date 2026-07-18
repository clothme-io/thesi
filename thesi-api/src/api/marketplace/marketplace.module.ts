import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { CreatorCrmModule } from 'src/api/creator-crm/creator-crm.module';
import {
  MARKETPLACE_CAMPAIGN_SYNC,
  MARKETPLACE_REPOSITORY,
} from './marketplace.repository';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { PostgresMarketplaceRepository } from './postgres-marketplace.repository';

@Module({
  imports: [AuthModule, forwardRef(() => CreatorCrmModule)],
  controllers: [MarketplaceController],
  providers: [
    MarketplaceService,
    {
      provide: MARKETPLACE_REPOSITORY,
      useClass: PostgresMarketplaceRepository,
    },
    {
      provide: MARKETPLACE_CAMPAIGN_SYNC,
      useExisting: MarketplaceService,
    },
  ],
  exports: [MARKETPLACE_CAMPAIGN_SYNC],
})
export class MarketplaceModule {}
