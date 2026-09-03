import {
  boolean,
  date,
  integer,
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

export type CampaignRequiredTaskJson = {
  id: string;
  title: string;
  description?: string;
  required: boolean;
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
  milestoneStructure?: 'cumulative' | 'highest_achieved';
  milestones?: CampaignMilestoneJson[];
  royaltyPercent?: number;
  notes?: string;
};

export type CampaignCreatorBenefitsJson = {
  guaranteedPaymentCents?: number;
  productsKept: boolean;
  bonusEligibility: boolean;
  creatorPoolEligibility: boolean;
  foundingCreatorRecognition: boolean;
  portfolioUse: boolean;
  priorityFutureCampaigns: boolean;
  brandOpportunityAccess: boolean;
  customBenefits: string[];
};

export type CampaignContentRightsJson = {
  organicUsage: boolean;
  websiteAppUsage: boolean;
  paidAdsUsage: boolean;
  duration: string;
  rawContentAccess: boolean;
};

export type CampaignProductProvidedJson = {
  id: string;
  name: string;
  quantity?: number;
  creatorKeeps: boolean;
};

export const campaign = thesiSchema.table('campaign', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  campaignType: text('campaign_type').notNull().default('experience'),
  contentTypes: jsonb('content_types').$type<string[]>().notNull().default([]),
  status: text('status').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  brief: text('brief').notNull().default(''),
  deliverables: text('deliverables').notNull().default(''),
  exampleVideoLinks: jsonb('example_video_links')
    .$type<string[]>()
    .notNull()
    .default([]),
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
  requiredTasks: jsonb('required_tasks')
    .$type<CampaignRequiredTaskJson[]>()
    .notNull()
    .default([]),
  creatorBenefits: jsonb('creator_benefits')
    .$type<CampaignCreatorBenefitsJson>()
    .notNull()
    .default({
      productsKept: false,
      bonusEligibility: false,
      creatorPoolEligibility: false,
      foundingCreatorRecognition: false,
      portfolioUse: false,
      priorityFutureCampaigns: false,
      brandOpportunityAccess: false,
      customBenefits: [],
    }),
  contentRights: jsonb('content_rights')
    .$type<CampaignContentRightsJson>()
    .notNull()
    .default({
      organicUsage: true,
      websiteAppUsage: false,
      paidAdsUsage: false,
      duration: '',
      rawContentAccess: false,
    }),
  productsProvided: jsonb('products_provided')
    .$type<CampaignProductProvidedJson[]>()
    .notNull()
    .default([]),
  creatorCapacity: integer('creator_capacity'),
  postToMarketplace: boolean('post_to_marketplace').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
