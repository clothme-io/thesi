import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { CREATOR_CRM_REPOSITORY } from './creator-crm.repository';
import { CreatorCrmController } from './creator-crm.controller';
import { CreatorCrmService } from './creator-crm.service';
import { PostgresCreatorCrmRepository } from './postgres-creator-crm.repository';

@Module({
  imports: [AuthModule],
  controllers: [CreatorCrmController],
  providers: [
    CreatorCrmService,
    {
      provide: CREATOR_CRM_REPOSITORY,
      useClass: PostgresCreatorCrmRepository,
    },
  ],
  exports: [CreatorCrmService],
})
export class CreatorCrmModule {}
