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
  hybrid?: {
    base?: {
      enabled: boolean;
      amountCents?: number;
      currency: 'USD';
      trigger:
        | 'campaign_accepted'
        | 'contract_signed'
        | 'content_submitted'
        | 'content_accepted'
        | 'content_published'
        | 'campaign_completed'
        | 'custom';
      customTrigger?: string;
    };
    milestones?: {
      enabled: boolean;
      metric:
        | 'views'
        | 'qualified_signups'
        | 'account_creations'
        | 'fit_profiles_completed'
        | 'purchases'
        | 'sales_revenue'
        | 'engagement'
        | 'clicks'
        | 'custom';
      customMetric?: string;
      payoutMethod: 'cumulative' | 'highest_achieved';
      amountType: 'total_compensation' | 'bonus_in_addition_to_base';
      tiers: CampaignMilestoneJson[];
    };
    affiliate?: {
      enabled: boolean;
      commissionType:
        | 'percentage_of_sale'
        | 'percentage_of_platform_commission'
        | 'fixed_amount_per_sale';
      commissionPercent?: number;
      fixedAmountCents?: number;
      currency: 'USD';
      attributionWindowDays?: number;
      terms?: string;
    };
    creatorPool?: {
      enabled: boolean;
      poolAmountCents?: number;
      currency: 'USD';
      campaignGoal?: string;
      distributionMethod:
        | 'impact_score'
        | 'proportional_performance'
        | 'equal_distribution'
        | 'manual'
        | 'custom';
      customDistributionMethod?: string;
      metrics: Array<{
        id: string;
        name: string;
        weightPercent: number;
      }>;
      settlementType: 'campaign_end' | 'days_after_campaign_end' | 'manual';
      settlementDays?: number;
      rules?: string;
    };
  };
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
  creatorDisclosureEnabled: boolean('creator_disclosure_enabled')
    .notNull()
    .default(false),
  postToMarketplace: boolean('post_to_marketplace').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const campaignAcceptanceSnapshot = thesiSchema.table(
  'campaign_acceptance_snapshot',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    campaignId: uuid('campaign_id')
      .notNull()
      .references(() => campaign.id, { onDelete: 'cascade' }),
    brandUserId: text('brand_user_id')
      .notNull()
      .references(() => thesiUser.id, { onDelete: 'cascade' }),
    creatorUserId: text('creator_user_id').references(() => thesiUser.id, {
      onDelete: 'set null',
    }),
    creatorEmail: text('creator_email').notNull(),
    creatorName: text('creator_name').notNull(),
    source: text('source').notNull(),
    sourceId: text('source_id').notNull(),
    campaignName: text('campaign_name').notNull(),
    campaignType: text('campaign_type').notNull(),
    contentTypes: jsonb('content_types').$type<string[]>().notNull(),
    startDate: date('start_date').notNull(),
    endDate: date('end_date').notNull(),
    brief: text('brief').notNull(),
    deliverables: text('deliverables').notNull(),
    paymentSnapshot: jsonb('payment_snapshot')
      .$type<CampaignPaymentJson>()
      .notNull(),
    creatorBenefitsSnapshot: jsonb('creator_benefits_snapshot')
      .$type<CampaignCreatorBenefitsJson>()
      .notNull(),
    productsProvidedSnapshot: jsonb('products_provided_snapshot')
      .$type<CampaignProductProvidedJson[]>()
      .notNull(),
    contentRightsSnapshot: jsonb('content_rights_snapshot')
      .$type<CampaignContentRightsJson>()
      .notNull(),
    requiredTasksSnapshot: jsonb('required_tasks_snapshot')
      .$type<CampaignRequiredTaskJson[]>()
      .notNull(),
    creatorCapacitySnapshot: integer('creator_capacity_snapshot'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);
