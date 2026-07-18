export const STRIPE_WEBHOOK_REPOSITORY = Symbol('STRIPE_WEBHOOK_REPOSITORY');

export type PlatformFeeWebhookRow = {
  id: string;
  campaignId: string;
  brandUserId: string;
  payoutCents: number;
  feeCents: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'waived';
  stripePaymentIntentId: string | null;
  idempotencyKey: string;
};

export type CreatorPayoutWebhookRow = {
  id: string;
  campaignId: string;
  brandUserId: string;
  creatorUserId: string;
  amountCents: number;
  currency: string;
  status: 'pending' | 'charged' | 'transferred' | 'failed';
  stripePaymentIntentId: string | null;
  stripeTransferId: string | null;
  stripeDestinationAccountId: string;
  idempotencyKey: string;
  failureReason: string | null;
};

export interface StripeWebhookRepository {
  hasProcessedEvent(eventId: string): Promise<boolean>;
  markEventProcessed(input: {
    eventId: string;
    type: string;
    livemode: boolean;
  }): Promise<void>;
  findPlatformFeeByPaymentIntent(
    paymentIntentId: string,
  ): Promise<PlatformFeeWebhookRow | null>;
  updatePlatformFeeStatus(
    id: string,
    status: PlatformFeeWebhookRow['status'],
  ): Promise<void>;
  findCreatorPayoutByPaymentIntent(
    paymentIntentId: string,
  ): Promise<CreatorPayoutWebhookRow | null>;
  findCreatorPayoutByTransferId(
    transferId: string,
  ): Promise<CreatorPayoutWebhookRow | null>;
  findCreatorPayoutByCampaignCreator(
    campaignId: string,
    creatorUserId: string,
  ): Promise<CreatorPayoutWebhookRow | null>;
  updateCreatorPayoutStatus(
    id: string,
    status: CreatorPayoutWebhookRow['status'],
    failureReason?: string | null,
    stripeTransferId?: string | null,
  ): Promise<void>;
}
