import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './dbConfig/drizzle/drizzle.module';
import { EmailModule } from './shared/email/email.module';
import { CreatorApplicationsModule } from './api/creator-applications/creator-applications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    EmailModule,
    CreatorApplicationsModule,
  ],
})
export class AppModule {}
