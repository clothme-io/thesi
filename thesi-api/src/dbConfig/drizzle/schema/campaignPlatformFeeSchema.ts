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

export const campaignPlatformFee = thesiSchema.table(
  'campaign_platform_fee',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    brandUserId: text('brand_user_id')
      .notNull()
      .references(() => thesiUser.id, { onDelete: 'cascade' }),
    payoutCents: integer('payout_cents').notNull().default(0),
    feeCents: integer('fee_cents').notNull().default(0),
    currency: text('currency').notNull().default('usd'),
    status: text('status').notNull().default('pending'),
    stripePaymentIntentId: text('stripe_payment_intent_id'),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => ({
    campaignUidx: uniqueIndex('campaign_platform_fee_campaign_uidx').on(
      table.campaignId,
    ),
  }),
);
