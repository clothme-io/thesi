import {
  boolean,
  date,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { campaign } from './campaignSchema';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export type MarketplacePaymentJson = {
  structure: 'flat_rate' | 'milestone' | 'royalty' | 'hybrid';
  currency: 'USD';
  flatAmountCents?: number;
  milestones?: Array<{
    label: string;
    amountCents: number;
    trigger: string;
  }>;
  royaltyPercent?: number;
  royaltyMinimumCents?: number;
  hybridFlatCents?: number;
  hybridRoyaltyPercent?: number;
  notes?: string;
};

export type MarketplaceFileJson = {
  id: string;
  name: string;
  sizeLabel: string;
};

export const marketplaceListing = thesiSchema.table('marketplace_listing', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .unique()
    .references(() => campaign.id, { onDelete: 'cascade' }),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  brandName: text('brand_name').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  applicationDeadline: date('application_deadline').notNull(),
  brief: text('brief').notNull().default(''),
  deliverables: text('deliverables').notNull().default(''),
  requirements: jsonb('requirements').$type<string[]>().notNull().default([]),
  files: jsonb('files').$type<MarketplaceFileJson[]>().notNull().default([]),
  payment: jsonb('payment')
    .$type<MarketplacePaymentJson>()
    .notNull()
    .default({ structure: 'flat_rate', currency: 'USD', flatAmountCents: 0 }),
  location: text('location').notNull().default('Remote'),
  remoteOk: boolean('remote_ok').notNull().default(true),
  slots: integer('slots').notNull().default(5),
  postedAt: timestamp('posted_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const marketplaceApplication = thesiSchema.table(
  'marketplace_application',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => marketplaceListing.id, { onDelete: 'cascade' }),
    creatorUserId: text('creator_user_id')
      .notNull()
      .references(() => thesiUser.id, { onDelete: 'cascade' }),
    pitch: text('pitch').notNull(),
    addedToCrm: boolean('added_to_crm').notNull().default(false),
    appliedAt: timestamp('applied_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const marketplaceCrmLink = thesiSchema.table(
  'marketplace_crm_link',
  {
    creatorUserId: text('creator_user_id')
      .notNull()
      .references(() => thesiUser.id, { onDelete: 'cascade' }),
    listingId: uuid('listing_id')
      .notNull()
      .references(() => marketplaceListing.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.creatorUserId, table.listingId] }),
  ],
);
