import { Module } from '@nestjs/common';
import { AuthModule } from 'src/api/auth/auth.module';
import { AdminApiKeyGuard } from 'src/shared/auth/admin-api-key.guard';
import { SocialOauthController } from './social-oauth.controller';
import { SocialController } from './social.controller';
import { SOCIAL_REPOSITORY, PostgresSocialRepository } from './social.repository';
import { SocialService } from './social.service';

@Module({
  imports: [AuthModule],
  controllers: [SocialController, SocialOauthController],
  providers: [
    SocialService,
    AdminApiKeyGuard,
    {
      provide: SOCIAL_REPOSITORY,
      useClass: PostgresSocialRepository,
    },
  ],
})
export class SocialModule {}
