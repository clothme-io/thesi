import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './dbConfig/drizzle/drizzle.module';
import { AuthModule } from './api/auth/auth.module';
import { CreatorApplicationsModule } from './api/creator-applications/creator-applications.module';
import { HealthController } from './api/health/health.controller';
import { EmailModule } from './shared/email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    EmailModule,
    AuthModule,
    CreatorApplicationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
