import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { INBOX_REPOSITORY } from './inbox.repository';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { PostgresInboxRepository } from './postgres-inbox.repository';

@Module({
  imports: [AuthModule],
  controllers: [InboxController],
  providers: [
    InboxService,
    {
      provide: INBOX_REPOSITORY,
      useClass: PostgresInboxRepository,
    },
  ],
  exports: [InboxService],
})
export class InboxModule {}
