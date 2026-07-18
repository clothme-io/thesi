import {
  boolean,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export const campaignInvite = thesiSchema.table('campaign_invite', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: text('campaign_id').notNull(),
  brandUserId: text('brand_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  campaignName: text('campaign_name').notNull(),
  brandName: text('brand_name').notNull(),
  creatorUserId: text('creator_user_id').references(() => thesiUser.id, {
    onDelete: 'set null',
  }),
  creatorEmail: text('creator_email').notNull(),
  creatorName: text('creator_name').notNull(),
  external: boolean('external').notNull().default(false),
  status: text('status').notNull().default('sent'),
  novuTransactionId: text('novu_transaction_id'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const platformBrandInvite = thesiSchema.table('platform_brand_invite', {
  id: uuid('id').primaryKey().defaultRandom(),
  invitedByUserId: text('invited_by_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  brandName: text('brand_name').notNull(),
  brandEmail: text('brand_email').notNull(),
  invitedByName: text('invited_by_name').notNull(),
  invitedByEmail: text('invited_by_email').notNull(),
  message: text('message'),
  addToCrm: boolean('add_to_crm').notNull().default(false),
  crmBrandId: text('crm_brand_id'),
  status: text('status').notNull().default('sent'),
  novuTransactionId: text('novu_transaction_id'),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
