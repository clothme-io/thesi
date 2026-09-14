import { MerchantLoginService } from './merchant-login.service';
import { MerchantLoginController, MerchantLoginInternalController, MerchantIdentityGuard } from './merchant-login.controller';
import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MerchantLinksService } from './merchant-links.service';
import { MerchantLinkInternalController, MerchantLinksController, MerchantServiceGuard } from './merchant-links.controller';

@Module({ imports: [AuthModule], controllers: [MerchantLoginController,MerchantLoginInternalController,MerchantLinkInternalController, MerchantLinksController], providers: [MerchantLoginService,MerchantIdentityGuard,MerchantLinksService, MerchantServiceGuard] })
export class MerchantLinksModule {}
