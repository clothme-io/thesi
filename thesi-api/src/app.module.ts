import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './dbConfig/drizzle/drizzle.module';
import { EmailModule } from './shared/email/email.module';
import { CreatorApplicationsModule } from './api/creator-applications/creator-applications.module';
import { HealthController } from './api/health/health.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    EmailModule,
    CreatorApplicationsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
