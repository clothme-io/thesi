import {
  integer,
  jsonb,
  numeric,
  pgSchema,
  text,
  timestamp,
  uuid,
  date,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export type CreatorPlatformStatsJson = {
  platform: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
};

export const creatorDirectoryStats = thesiSchema.table(
  'creator_directory_stats',
  {
    creatorUserId: text('creator_user_id')
      .primaryKey()
      .references(() => thesiUser.id, { onDelete: 'cascade' }),
    totalFollowers: integer('total_followers').notNull().default(0),
    avgViews: integer('avg_views').notNull().default(0),
    avgEngagementRate: numeric('avg_engagement_rate', {
      precision: 6,
      scale: 2,
    })
      .notNull()
      .default('0'),
    completedCampaigns: integer('completed_campaigns').notNull().default(0),
    responseRate: integer('response_rate').notNull().default(0),
    platforms: jsonb('platforms')
      .$type<CreatorPlatformStatsJson[]>()
      .notNull()
      .default([]),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const creatorUgcPost = thesiSchema.table('creator_ugc_post', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  platform: text('platform').notNull(),
  campaignName: text('campaign_name'),
  brandName: text('brand_name'),
  postedAt: date('posted_at').notNull(),
  views: integer('views').notNull().default(0),
  likes: integer('likes').notNull().default(0),
  comments: integer('comments').notNull().default(0),
  shares: integer('shares').notNull().default(0),
  saves: integer('saves').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const brandCreatorFavorite = thesiSchema.table(
  'brand_creator_favorite',
  {
    brandUserId: text('brand_user_id')
      .notNull()
      .references(() => thesiUser.id, { onDelete: 'cascade' }),
    creatorUserId: text('creator_user_id')
      .notNull()
      .references(() => thesiUser.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.brandUserId, table.creatorUserId] })],
);
