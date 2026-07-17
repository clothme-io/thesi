import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './dbConfig/drizzle/drizzle.module';
import { AuthModule } from './api/auth/auth.module';
import { CreatorApplicationsModule } from './api/creator-applications/creator-applications.module';
import {
  HealthController,
  ReadinessController,
} from './api/health/health.controller';
import { validateEnv } from './platform/config/env.validation';
import { EmailModule } from './shared/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DrizzleModule,
    EmailModule,
    AuthModule,
    CreatorApplicationsModule,
  ],
  controllers: [HealthController, ReadinessController],
})
export class AppModule {}
