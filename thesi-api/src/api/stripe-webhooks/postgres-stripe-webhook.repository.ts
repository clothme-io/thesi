import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type {
  CreatorPayoutWebhookRow,
  PlatformFeeWebhookRow,
  StripeWebhookRepository,
} from './stripe-webhook.repository';

@Injectable()
export class PostgresStripeWebhookRepository
  implements StripeWebhookRepository
{
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async hasProcessedEvent(eventId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.stripeWebhookEvent.id })
      .from(schema.stripeWebhookEvent)
      .where(eq(schema.stripeWebhookEvent.id, eventId))
      .limit(1);
    return Boolean(row);
  }

  async markEventProcessed(input: {
    eventId: string;
    type: string;
    livemode: boolean;
  }): Promise<void> {
    await this.db
      .insert(schema.stripeWebhookEvent)
      .values({
        id: input.eventId,
        type: input.type,
        livemode: input.livemode,
      })
      .onConflictDoNothing();
  }

  async findPlatformFeeByPaymentIntent(paymentIntentId: string) {
    const [row] = await this.db
      .select()
      .from(schema.campaignPlatformFee)
      .where(
        eq(schema.campaignPlatformFee.stripePaymentIntentId, paymentIntentId),
      )
      .limit(1);
    return row ? this.toFee(row) : null;
  }

  async updatePlatformFeeStatus(
    id: string,
    status: PlatformFeeWebhookRow['status'],
  ): Promise<void> {
    await this.db
      .update(schema.campaignPlatformFee)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.campaignPlatformFee.id, id));
  }

  async findCreatorPayoutByPaymentIntent(paymentIntentId: string) {
    const [row] = await this.db
      .select()
      .from(schema.creatorPayout)
      .where(eq(schema.creatorPayout.stripePaymentIntentId, paymentIntentId))
      .limit(1);
    return row ? this.toPayout(row) : null;
  }

  async findCreatorPayoutByTransferId(transferId: string) {
    const [row] = await this.db
      .select()
      .from(schema.creatorPayout)
      .where(eq(schema.creatorPayout.stripeTransferId, transferId))
      .limit(1);
    return row ? this.toPayout(row) : null;
  }

  async findCreatorPayoutByCampaignCreator(
    campaignId: string,
    creatorUserId: string,
  ) {
    const [row] = await this.db
      .select()
      .from(schema.creatorPayout)
      .where(
        and(
          eq(schema.creatorPayout.campaignId, campaignId),
          eq(schema.creatorPayout.creatorUserId, creatorUserId),
        ),
      )
      .limit(1);
    return row ? this.toPayout(row) : null;
  }

  async updateCreatorPayoutStatus(
    id: string,
    status: CreatorPayoutWebhookRow['status'],
    failureReason?: string | null,
    stripeTransferId?: string | null,
  ): Promise<void> {
    await this.db
      .update(schema.creatorPayout)
      .set({
        status,
        failureReason: failureReason ?? null,
        ...(stripeTransferId !== undefined
          ? { stripeTransferId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.creatorPayout.id, id));
  }

  private toFee(
    row: typeof schema.campaignPlatformFee.$inferSelect,
  ): PlatformFeeWebhookRow {
    return {
      id: row.id,
      campaignId: row.campaignId,
      brandUserId: row.brandUserId,
      payoutCents: row.payoutCents,
      feeCents: row.feeCents,
      currency: row.currency,
      status: row.status as PlatformFeeWebhookRow['status'],
      stripePaymentIntentId: row.stripePaymentIntentId,
      idempotencyKey: row.idempotencyKey,
    };
  }

  private toPayout(
    row: typeof schema.creatorPayout.$inferSelect,
  ): CreatorPayoutWebhookRow {
    return {
      id: row.id,
      campaignId: row.campaignId,
      brandUserId: row.brandUserId,
      creatorUserId: row.creatorUserId,
      amountCents: row.amountCents,
      currency: row.currency,
      status: row.status as CreatorPayoutWebhookRow['status'],
      stripePaymentIntentId: row.stripePaymentIntentId,
      stripeTransferId: row.stripeTransferId,
      stripeDestinationAccountId: row.stripeDestinationAccountId,
      idempotencyKey: row.idempotencyKey,
      failureReason: row.failureReason,
    };
  }
}
