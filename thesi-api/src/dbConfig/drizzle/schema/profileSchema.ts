import { pgSchema, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export const creatorProfile = thesiSchema.table('creator_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  headline: text('headline').notNull().default('UGC Creator'),
  bio: text('bio').notNull().default(''),
  location: text('location').notNull().default(''),
  website: text('website').notNull().default(''),
  instagram: text('instagram').notNull().default(''),
  tiktok: text('tiktok').notNull().default(''),
  youtube: text('youtube').notNull().default(''),
  niches: text('niches').array().notNull().default([]),
  platforms: text('platforms').array().notNull().default([]),
  followerRange: text('follower_range').notNull().default(''),
  rateRange: text('rate_range').notNull().default(''),
  turnaround: text('turnaround')
    .notNull()
    .default('3–5 business days'),
  portfolioUrl: text('portfolio_url').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const brandProfile = thesiSchema.table('brand_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .unique()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  companyName: text('company_name').notNull(),
  tagline: text('tagline')
    .notNull()
    .default('Fashion & lifestyle brand'),
  about: text('about').notNull().default(''),
  website: text('website').notNull().default(''),
  headquarters: text('headquarters').notNull().default(''),
  industry: text('industry').notNull().default(''),
  instagram: text('instagram').notNull().default(''),
  tiktok: text('tiktok').notNull().default(''),
  youtube: text('youtube').notNull().default(''),
  linkedin: text('linkedin').notNull().default(''),
  companySize: text('company_size').notNull().default(''),
  typicalBudgetRange: text('typical_budget_range').notNull().default(''),
  primaryGoal: text('primary_goal').notNull().default(''),
  preferredCreatorNiches: text('preferred_creator_niches')
    .array()
    .notNull()
    .default([]),
  preferredPlatforms: text('preferred_platforms')
    .array()
    .notNull()
    .default([]),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
