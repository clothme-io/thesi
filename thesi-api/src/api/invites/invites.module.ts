import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { CreatorCrmModule } from 'src/api/creator-crm/creator-crm.module';
import { CreatorTrackingModule } from 'src/api/creator-tracking/creator-tracking.module';
import { InboxModule } from 'src/api/inbox/inbox.module';
import { INVITES_REPOSITORY } from './invites.repository';
import { InvitesController } from './invites.controller';
import { InvitesService } from './invites.service';
import { PostgresInvitesRepository } from './postgres-invites.repository';

@Module({
  imports: [
    AuthModule,
    InboxModule,
    CreatorCrmModule,
    forwardRef(() => CreatorTrackingModule),
  ],
  controllers: [InvitesController],
  providers: [
    InvitesService,
    {
      provide: INVITES_REPOSITORY,
      useClass: PostgresInvitesRepository,
    },
  ],
  exports: [INVITES_REPOSITORY, InvitesService],
})
export class InvitesModule {}
