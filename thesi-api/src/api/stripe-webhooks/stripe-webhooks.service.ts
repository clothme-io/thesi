import { Inject, Injectable, Logger } from '@nestjs/common';
import type Stripe from 'stripe';
import {
  STRIPE_WEBHOOK_REPOSITORY,
  type StripeWebhookRepository,
} from './stripe-webhook.repository';

export type WebhookHandleResult = {
  received: true;
  duplicate?: boolean;
  action?: string;
};

@Injectable()
export class StripeWebhooksService {
  private readonly logger = new Logger(StripeWebhooksService.name);

  constructor(
    @Inject(STRIPE_WEBHOOK_REPOSITORY)
    private readonly webhooks: StripeWebhookRepository,
  ) {}

  async handleEvent(event: Stripe.Event): Promise<WebhookHandleResult> {
    if (await this.webhooks.hasProcessedEvent(event.id)) {
      return { received: true, duplicate: true };
    }

    let action = 'ignored';
    switch (event.type) {
      case 'payment_intent.succeeded':
        action = await this.onPaymentIntentSucceeded(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case 'payment_intent.payment_failed':
        action = await this.onPaymentIntentFailed(
          event.data.object as Stripe.PaymentIntent,
        );
        break;
      case 'transfer.created':
      case 'transfer.updated':
        action = await this.onTransferSynced(
          event.data.object as Stripe.Transfer,
        );
        break;
      case 'transfer.reversed':
        action = await this.onTransferReversed(
          event.data.object as Stripe.Transfer,
        );
        break;
      case 'account.updated':
        action = 'account.updated_logged';
        this.logger.log(
          `Connect account.updated ${(event.data.object as Stripe.Account).id}`,
        );
        break;
      default:
        action = `ignored:${event.type}`;
        break;
    }

    await this.webhooks.markEventProcessed({
      eventId: event.id,
      type: event.type,
      livemode: Boolean(event.livemode),
    });

    return { received: true, action };
  }

  private async onPaymentIntentSucceeded(
    intent: Stripe.PaymentIntent,
  ): Promise<string> {
    const type = intent.metadata?.type;
    if (type === 'campaign_platform_fee') {
      const fee = await this.webhooks.findPlatformFeeByPaymentIntent(intent.id);
      if (!fee) return 'fee_not_found';
      if (fee.status !== 'paid' && fee.status !== 'waived') {
        await this.webhooks.updatePlatformFeeStatus(fee.id, 'paid');
      }
      return 'platform_fee_paid';
    }
    if (type === 'creator_payout') {
      const payout = await this.webhooks.findCreatorPayoutByPaymentIntent(
        intent.id,
      );
      if (!payout) return 'payout_not_found';
      if (payout.status === 'pending' || payout.status === 'failed') {
        await this.webhooks.updateCreatorPayoutStatus(payout.id, 'charged');
      }
      return 'creator_payout_charged';
    }
    return 'pi_succeeded_unmatched';
  }

  private async onPaymentIntentFailed(
    intent: Stripe.PaymentIntent,
  ): Promise<string> {
    const type = intent.metadata?.type;
    const reason =
      intent.last_payment_error?.message || 'PaymentIntent payment_failed';
    if (type === 'campaign_platform_fee') {
      const fee = await this.webhooks.findPlatformFeeByPaymentIntent(intent.id);
      if (!fee) return 'fee_not_found';
      if (fee.status !== 'waived') {
        await this.webhooks.updatePlatformFeeStatus(fee.id, 'failed');
      }
      return 'platform_fee_failed';
    }
    if (type === 'creator_payout') {
      const payout = await this.webhooks.findCreatorPayoutByPaymentIntent(
        intent.id,
      );
      if (!payout) return 'payout_not_found';
      if (payout.status !== 'transferred') {
        await this.webhooks.updateCreatorPayoutStatus(
          payout.id,
          'failed',
          reason,
        );
      }
      return 'creator_payout_failed';
    }
    return 'pi_failed_unmatched';
  }

  private async resolvePayoutForTransfer(transfer: Stripe.Transfer) {
    const byTransfer = await this.webhooks.findCreatorPayoutByTransferId(
      transfer.id,
    );
    if (byTransfer) return byTransfer;
    const campaignId = transfer.metadata?.campaignId;
    const creatorUserId = transfer.metadata?.creatorUserId;
    if (!campaignId || !creatorUserId) return null;
    return this.webhooks.findCreatorPayoutByCampaignCreator(
      campaignId,
      creatorUserId,
    );
  }

  private async onTransferSynced(transfer: Stripe.Transfer): Promise<string> {
    const payout = await this.resolvePayoutForTransfer(transfer);
    if (!payout) return 'transfer_unmatched';
    if (payout.status !== 'transferred') {
      await this.webhooks.updateCreatorPayoutStatus(
        payout.id,
        'transferred',
        null,
        transfer.id,
      );
    }
    return 'creator_payout_transferred';
  }

  private async onTransferReversed(transfer: Stripe.Transfer): Promise<string> {
    const payout = await this.resolvePayoutForTransfer(transfer);
    if (!payout) return 'transfer_unmatched';
    await this.webhooks.updateCreatorPayoutStatus(
      payout.id,
      'failed',
      'Stripe transfer.reversed',
      transfer.id,
    );
    return 'creator_payout_transfer_reversed';
  }
}
