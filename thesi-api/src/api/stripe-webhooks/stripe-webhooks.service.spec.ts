import type Stripe from 'stripe';
import type {
  CreatorPayoutWebhookRow,
  PlatformFeeWebhookRow,
  StripeWebhookRepository,
} from './stripe-webhook.repository';
import { StripeWebhooksService } from './stripe-webhooks.service';

class FakeWebhookRepository implements StripeWebhookRepository {
  events = new Set<string>();
  fees = new Map<string, PlatformFeeWebhookRow>();
  payouts = new Map<string, CreatorPayoutWebhookRow>();

  async hasProcessedEvent(eventId: string) {
    return this.events.has(eventId);
  }

  async markEventProcessed(input: {
    eventId: string;
    type: string;
    livemode: boolean;
  }) {
    this.events.add(input.eventId);
  }

  async findPlatformFeeByPaymentIntent(paymentIntentId: string) {
    return (
      [...this.fees.values()].find(
        (fee) => fee.stripePaymentIntentId === paymentIntentId,
      ) ?? null
    );
  }

  async updatePlatformFeeStatus(
    id: string,
    status: PlatformFeeWebhookRow['status'],
  ) {
    const fee = this.fees.get(id);
    if (fee) fee.status = status;
  }

  async findCreatorPayoutByPaymentIntent(paymentIntentId: string) {
    return (
      [...this.payouts.values()].find(
        (p) => p.stripePaymentIntentId === paymentIntentId,
      ) ?? null
    );
  }

  async findCreatorPayoutByTransferId(transferId: string) {
    return (
      [...this.payouts.values()].find(
        (p) => p.stripeTransferId === transferId,
      ) ?? null
    );
  }

  async findCreatorPayoutByCampaignCreator(
    campaignId: string,
    creatorUserId: string,
  ) {
    return (
      [...this.payouts.values()].find(
        (p) =>
          p.campaignId === campaignId && p.creatorUserId === creatorUserId,
      ) ?? null
    );
  }

  async updateCreatorPayoutStatus(
    id: string,
    status: CreatorPayoutWebhookRow['status'],
    failureReason?: string | null,
    stripeTransferId?: string | null,
  ) {
    const payout = this.payouts.get(id);
    if (!payout) return;
    payout.status = status;
    payout.failureReason = failureReason ?? null;
    if (stripeTransferId !== undefined) {
      payout.stripeTransferId = stripeTransferId;
    }
  }
}

function event(
  type: Stripe.Event.Type,
  object: Record<string, unknown>,
  id = `evt_${type}`,
): Stripe.Event {
  return {
    id,
    object: 'event',
    api_version: '2024-01-01',
    created: Math.floor(Date.now() / 1000),
    data: { object: object as never },
    livemode: false,
    pending_webhooks: 0,
    request: null,
    type,
  } as Stripe.Event;
}

describe('StripeWebhooksService', () => {
  let repo: FakeWebhookRepository;
  let service: StripeWebhooksService;

  beforeEach(() => {
    repo = new FakeWebhookRepository();
    service = new StripeWebhooksService(repo);
  });

  it('marks platform fee paid on payment_intent.succeeded', async () => {
    repo.fees.set('fee-1', {
      id: 'fee-1',
      campaignId: 'camp-1',
      brandUserId: 'brand-1',
      payoutCents: 100_000,
      feeCents: 2_000,
      currency: 'usd',
      status: 'pending',
      stripePaymentIntentId: 'pi_fee',
      idempotencyKey: 'fee-key',
    });

    const result = await service.handleEvent(
      event('payment_intent.succeeded', {
        id: 'pi_fee',
        metadata: { type: 'campaign_platform_fee' },
      }),
    );

    expect(result.action).toBe('platform_fee_paid');
    expect(repo.fees.get('fee-1')?.status).toBe('paid');
    expect(repo.events.has('evt_payment_intent.succeeded')).toBe(true);
  });

  it('is idempotent for duplicate event ids', async () => {
    repo.events.add('evt_dup');
    const result = await service.handleEvent(
      event(
        'payment_intent.succeeded',
        { id: 'pi_x', metadata: { type: 'campaign_platform_fee' } },
        'evt_dup',
      ),
    );
    expect(result.duplicate).toBe(true);
  });

  it('marks creator payout transferred from transfer.created metadata', async () => {
    repo.payouts.set('payout-1', {
      id: 'payout-1',
      campaignId: 'camp-9',
      brandUserId: 'brand-1',
      creatorUserId: 'creator-9',
      amountCents: 50_000,
      currency: 'usd',
      status: 'charged',
      stripePaymentIntentId: 'pi_pay',
      stripeTransferId: null,
      stripeDestinationAccountId: 'acct_1',
      idempotencyKey: 'pay-key',
      failureReason: null,
    });

    const result = await service.handleEvent(
      event('transfer.created', {
        id: 'tr_1',
        metadata: { campaignId: 'camp-9', creatorUserId: 'creator-9' },
      }),
    );

    expect(result.action).toBe('creator_payout_transferred');
    expect(repo.payouts.get('payout-1')?.status).toBe('transferred');
    expect(repo.payouts.get('payout-1')?.stripeTransferId).toBe('tr_1');
  });

  it('marks creator payout failed on payment_intent.payment_failed', async () => {
    repo.payouts.set('payout-2', {
      id: 'payout-2',
      campaignId: 'camp-2',
      brandUserId: 'brand-1',
      creatorUserId: 'creator-2',
      amountCents: 10_000,
      currency: 'usd',
      status: 'pending',
      stripePaymentIntentId: 'pi_fail',
      stripeTransferId: null,
      stripeDestinationAccountId: 'acct_2',
      idempotencyKey: 'fail-key',
      failureReason: null,
    });

    const result = await service.handleEvent(
      event('payment_intent.payment_failed', {
        id: 'pi_fail',
        metadata: { type: 'creator_payout' },
        last_payment_error: { message: 'Card declined' },
      }),
    );

    expect(result.action).toBe('creator_payout_failed');
    expect(repo.payouts.get('payout-2')?.status).toBe('failed');
    expect(repo.payouts.get('payout-2')?.failureReason).toBe('Card declined');
  });
});
