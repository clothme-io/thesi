import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { FILE_STORAGE } from 'src/shared/storage/file-storage.port';
import { ConfigurableFileStorage } from 'src/shared/storage/file-storage';
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
    {
      provide: FILE_STORAGE,
      useClass: ConfigurableFileStorage,
    },
  ],
  exports: [CreatorCrmService],
})
export class CreatorCrmModule {}
