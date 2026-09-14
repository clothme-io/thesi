import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { WorkspaceAccessInterceptor } from './workspace-access.interceptor';
import { AuthModule } from '../auth/auth.module';
import { BrandWorkspacesController } from './brand-workspaces.controller';
import { BrandWorkspacesService } from './brand-workspaces.service';

@Module({
  imports: [AuthModule],
  controllers: [BrandWorkspacesController],
  providers: [BrandWorkspacesService, { provide: APP_INTERCEPTOR, useClass: WorkspaceAccessInterceptor }],
})
export class BrandWorkspacesModule {}
