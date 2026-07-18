import {
  boolean,
  date,
  jsonb,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export type CampaignRequirementsJson = {
  niches: string[];
  minFollowersRange: string;
  location: string;
  platforms: string[];
};

export type CampaignFileJson = {
  id: string;
  name: string;
  sizeLabel: string;
};

export type CampaignMilestoneJson = {
  id: string;
  label: string;
  trigger: string;
  amountCents: number;
};

export type CampaignPaymentJson = {
  model: 'flat_rate' | 'milestone' | 'royalty' | 'hybrid';
  flatRateCents?: number;
  milestones?: CampaignMilestoneJson[];
  royaltyPercent?: number;
  notes?: string;
};

export const campaign = thesiSchema.table('campaign', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  brief: text('brief').notNull().default(''),
  deliverables: text('deliverables').notNull().default(''),
  requirements: jsonb('requirements')
    .$type<CampaignRequirementsJson>()
    .notNull()
    .default({
      niches: [],
      minFollowersRange: '',
      location: '',
      platforms: [],
    }),
  files: jsonb('files').$type<CampaignFileJson[]>().notNull().default([]),
  payment: jsonb('payment')
    .$type<CampaignPaymentJson>()
    .notNull()
    .default({ model: 'flat_rate', flatRateCents: 0 }),
  postToMarketplace: boolean('post_to_marketplace').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
