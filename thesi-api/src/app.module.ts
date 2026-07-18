import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './dbConfig/drizzle/drizzle.module';
import { AuthModule } from './api/auth/auth.module';
import { CreatorApplicationsModule } from './api/creator-applications/creator-applications.module';
import { ProfilesModule } from './api/profiles/profiles.module';
import { SettingsModule } from './api/settings/settings.module';
import { CampaignsModule } from './api/campaigns/campaigns.module';
import { CreatorsModule } from './api/creators/creators.module';
import { MarketplaceModule } from './api/marketplace/marketplace.module';
import { CreatorCrmModule } from './api/creator-crm/creator-crm.module';
import { InboxModule } from './api/inbox/inbox.module';
import { InvitesModule } from './api/invites/invites.module';
import { BillingModule } from './api/billing/billing.module';
import { ConnectModule } from './api/connect/connect.module';
import { StripeWebhooksModule } from './api/stripe-webhooks/stripe-webhooks.module';
import {
  HealthController,
  ReadinessController,
} from './api/health/health.controller';
import { validateEnv } from './platform/config/env.validation';
import { EmailModule } from './shared/email/email.module';
import { NovuModule } from './shared/novu/novu.module';
import { StripeModule } from './shared/stripe/stripe.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    DrizzleModule,
    EmailModule,
    NovuModule,
    StripeModule,
    AuthModule,
    CreatorApplicationsModule,
    ProfilesModule,
    SettingsModule,
    CampaignsModule,
    CreatorsModule,
    MarketplaceModule,
    CreatorCrmModule,
    InboxModule,
    InvitesModule,
    BillingModule,
    ConnectModule,
    StripeWebhooksModule,
  ],
  controllers: [HealthController, ReadinessController],
})
export class AppModule {}
