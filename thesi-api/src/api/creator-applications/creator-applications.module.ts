import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { AdminApiKeyGuard } from 'src/shared/auth/admin-api-key.guard';
import { CreatorApplicationsController } from './creator-applications.controller';
import { CreatorApplicationsService } from './creator-applications.service';

@Module({
  imports: [AuthModule],
  controllers: [CreatorApplicationsController],
  providers: [CreatorApplicationsService, AdminApiKeyGuard],
})
export class CreatorApplicationsModule {}
