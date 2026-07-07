import { Module } from '@nestjs/common';
import { CreatorApplicationsController } from './creator-applications.controller';
import { CreatorApplicationsService } from './creator-applications.service';

@Module({
  controllers: [CreatorApplicationsController],
  providers: [CreatorApplicationsService],
})
export class CreatorApplicationsModule {}
