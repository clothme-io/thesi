import { boolean, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

const thesiSchema = pgSchema('thesi');

export const stripeWebhookEvent = thesiSchema.table('stripe_webhook_event', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  livemode: boolean('livemode').notNull().default(false),
  processedAt: timestamp('processed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
