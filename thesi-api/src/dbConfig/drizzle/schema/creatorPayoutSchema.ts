import {
  integer,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { campaign } from './campaignSchema';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export const creatorPayout = thesiSchema.table(
  'creator_payout',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    brandUserId: text('brand_user_id')
      .notNull()
      .references(() => thesiUser.id, { onDelete: 'cascade' }),
    creatorUserId: text('creator_user_id')
      .notNull()
      .references(() => thesiUser.id, { onDelete: 'cascade' }),
    amountCents: integer('amount_cents').notNull(),
    currency: text('currency').notNull().default('usd'),
    status: text('status').notNull().default('pending'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    stripeTransferId: text('stripe_transfer_id'),
    stripeDestinationAccountId: text('stripe_destination_account_id').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    failureReason: text('failure_reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    campaignCreatorUidx: uniqueIndex('creator_payout_campaign_creator_uidx').on(
      table.campaignId,
      table.creatorUserId,
    ),
  }),
);
