import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
@Injectable()
export class FundingGateway {
  constructor(private readonly config: ConfigService) {}
  protected stripe() {
    if (this.config.get('CAMPAIGN_FUNDING_ENABLED') !== true)
      throw new ServiceUnavailableException('Campaign funding is disabled');
    return new Stripe(this.config.getOrThrow<string>('STRIPE_SECRET_KEY'), {
      timeout: 15000,
      maxNetworkRetries: 0,
    });
  }
  async execute(
    op: any,
  ): Promise<{ id: string; chargeId?: string; pending?: boolean }> {
    const stripe = this.stripe();
    const key = `thesi-fund:${op.id}${op.args.refundRetryId ? `:${op.args.refundRetryId}` : ''}`;
    if (op.kind === 'deposit') {
      let pi: Stripe.PaymentIntent;
      try {
        pi = op.provider_id
          ? await stripe.paymentIntents.retrieve(op.provider_id)
          : await stripe.paymentIntents.create(
              {
                amount: Number(op.amount_cents),
                currency: 'usd',
                customer: op.args.customerId,
                payment_method: op.args.paymentMethodId,
                payment_method_types: ['card'],
                confirm: true,
                off_session: true,
                metadata: {
                  campaignId: op.campaign_id,
                  type: 'campaign_base_deposit',
                  fundingOperationId: op.id,
                },
                description: 'Thesi campaign base deposit',
              },
              { idempotencyKey: key },
            );
      } catch (e) {
        const id =
          (e as any)?.raw?.payment_intent?.id ?? (e as any)?.payment_intent?.id;
        if (!id) throw e;
        pi = await stripe.paymentIntents.retrieve(id);
      }
      if (
        pi.amount !== Number(op.amount_cents) ||
        pi.currency !== 'usd' ||
        pi.customer !== op.args.customerId
      )
        throw new Error('Deposit verification mismatch');
      if (
        pi.status !== 'succeeded' ||
        pi.amount_received !== Number(op.amount_cents)
      )
        return { id: pi.id, pending: true };
      const chargeId =
        typeof pi.latest_charge === 'string'
          ? pi.latest_charge
          : pi.latest_charge?.id;
      if (!chargeId) throw new Error('Captured deposit has no charge');
      return { id: pi.id, chargeId };
    }
    const charge = await stripe.charges.retrieve(op.args.chargeId);
    if (
      !charge.paid ||
      !charge.captured ||
      charge.disputed ||
      charge.currency !== 'usd'
    )
      throw new Error('Deposit charge requires review');
    // Charge refunds other than the recorded unused-slot operation must be reconciled before release.
    if (op.kind === 'release') {
      if (charge.amount_refunded !== op.args.expectedRefundCents)
        throw new Error('Deposit refund state requires reconciliation');
      const transfer = await stripe.transfers.create(
        {
          amount: Number(op.amount_cents),
          currency: 'usd',
          destination: op.args.destination,
          source_transaction: op.args.chargeId,
          transfer_group: `campaign:${op.campaign_id}`,
          metadata: {
            campaignId: op.campaign_id,
            obligationId: op.obligation_id,
            fundingOperationId: op.id,
          },
        },
        { idempotencyKey: key },
      );
      if (
        transfer.amount !== Number(op.amount_cents) ||
        transfer.currency !== 'usd' ||
        transfer.destination !== op.args.destination
      )
        throw new Error('Transfer verification mismatch');
      return { id: transfer.id };
    }
    const refund = op.provider_id
      ? await stripe.refunds.retrieve(op.provider_id)
      : await stripe.refunds.create(
          {
            payment_intent: op.args.paymentIntentId,
            amount: Number(op.amount_cents),
            metadata: {
              campaignId: op.campaign_id,
              type: 'unused_creator_slots',
              fundingOperationId: op.id,
            },
          },
          { idempotencyKey: key },
        );
    if (
      refund.amount !== Number(op.amount_cents) ||
      refund.currency !== 'usd' ||
      refund.payment_intent !== op.args.paymentIntentId
    )
      throw new Error('Refund verification mismatch');
    if (refund.status === 'failed' || refund.status === 'canceled')
      throw new Error('Refund requires manual recovery');
    return { id: refund.id, pending: refund.status !== 'succeeded' };
  }
  async depositAction(op: any, paymentMethodId: string) {
    if (op.kind !== 'deposit' || !op.provider_id)
      throw new Error('Deposit outcome needs reconciliation first');
    const pi = await this.stripe().paymentIntents.retrieve(op.provider_id);
    if (
      pi.amount !== Number(op.amount_cents) ||
      pi.customer !== op.args.customerId ||
      pi.currency !== 'usd'
    )
      throw new Error('Deposit verification mismatch');
    if (
      ![
        'requires_action',
        'requires_payment_method',
        'requires_confirmation',
      ].includes(pi.status)
    )
      return { status: pi.status };
    return {
      status: pi.status,
      clientSecret: pi.client_secret,
      paymentMethodId,
    };
  }
  async verifyRecovery(op: any, providerId: string) {
    const stripe = this.stripe();
    if (op.kind === 'deposit') {
      const pi = await stripe.paymentIntents.retrieve(providerId);
      if (
        pi.status !== 'succeeded' ||
        pi.amount_received !== Number(op.amount_cents) ||
        pi.amount !== Number(op.amount_cents) ||
        pi.currency !== 'usd' ||
        pi.customer !== op.args.customerId ||
        pi.metadata?.fundingOperationId !== op.id ||
        pi.metadata?.campaignId !== op.campaign_id ||
        pi.metadata.type !== 'campaign_base_deposit'
      )
        throw new Error('Captured deposit does not match');
      const chargeId =
        typeof pi.latest_charge === 'string'
          ? pi.latest_charge
          : pi.latest_charge?.id;
      if (!chargeId) throw new Error('Charge missing');
      return { id: pi.id, chargeId };
    }
    if (op.kind === 'release') {
      const t = await stripe.transfers.retrieve(providerId);
      if (
        t.amount !== Number(op.amount_cents) ||
        t.currency !== 'usd' ||
        t.destination !== op.args.destination ||
        t.source_transaction !== op.args.chargeId ||
        t.metadata?.fundingOperationId !== op.id ||
        t.metadata?.obligationId !== op.obligation_id ||
        t.metadata.campaignId !== op.campaign_id
      )
        throw new Error('Transfer does not match');
      if (t.amount_reversed > 0)
        throw new Error('Reversed transfer requires dispute reconciliation');
      return { id: t.id };
    }
    const r = await stripe.refunds.retrieve(providerId);
    if (
      r.status !== 'succeeded' ||
      r.amount !== Number(op.amount_cents) ||
      r.currency !== 'usd' ||
      r.payment_intent !== op.args.paymentIntentId ||
      r.metadata?.fundingOperationId !== op.id ||
      r.metadata?.campaignId !== op.campaign_id
    )
      throw new Error('Refund does not match');
    return { id: r.id };
  }
  async verifyFailedRefund(op: any) {
    if (
      !['refund_unused', 'refund_cancelled'].includes(op.kind) ||
      !op.provider_id
    )
      throw new Error('Known failed refund required');
    const r = await this.stripe().refunds.retrieve(op.provider_id);
    if (
      !['failed', 'canceled'].includes(r.status ?? '') ||
      r.payment_intent !== op.args.paymentIntentId ||
      r.amount !== Number(op.amount_cents)
    )
      throw new Error('Refund is not terminally failed');
  }
}
