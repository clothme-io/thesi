import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { CreatorCrmModule } from 'src/api/creator-crm/creator-crm.module';
import { InboxModule } from 'src/api/inbox/inbox.module';
import { InvitesModule } from 'src/api/invites/invites.module';
import { ConfigurableFileStorage } from 'src/shared/storage/file-storage';
import { FILE_STORAGE } from 'src/shared/storage/file-storage.port';
import {
  MARKETPLACE_CAMPAIGN_SYNC,
  MARKETPLACE_REPOSITORY,
} from './marketplace.repository';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { PostgresMarketplaceRepository } from './postgres-marketplace.repository';

@Module({
  imports: [
    AuthModule,
    forwardRef(() => CreatorCrmModule),
    InboxModule,
    InvitesModule,
  ],
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
    {
      provide: FILE_STORAGE,
      useClass: ConfigurableFileStorage,
    },
  ],
  exports: [MARKETPLACE_CAMPAIGN_SYNC],
})
export class MarketplaceModule {}
