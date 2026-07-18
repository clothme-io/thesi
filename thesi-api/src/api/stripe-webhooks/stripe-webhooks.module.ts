import { Module } from '@nestjs/common';
import { STRIPE_WEBHOOK_REPOSITORY } from './stripe-webhook.repository';
import { PostgresStripeWebhookRepository } from './postgres-stripe-webhook.repository';
import { StripeWebhooksController } from './stripe-webhooks.controller';
import { StripeWebhooksService } from './stripe-webhooks.service';

@Module({
  controllers: [StripeWebhooksController],
  providers: [
    StripeWebhooksService,
    {
      provide: STRIPE_WEBHOOK_REPOSITORY,
      useClass: PostgresStripeWebhookRepository,
    },
  ],
})
export class StripeWebhooksModule {}
