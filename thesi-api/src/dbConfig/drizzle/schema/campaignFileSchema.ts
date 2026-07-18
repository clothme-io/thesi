import {
  bigint,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { campaign } from './campaignSchema';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export const campaignFile = thesiSchema.table('campaign_file', {
  id: uuid('id').primaryKey().defaultRandom(),
  campaignId: uuid('campaign_id')
    .notNull()
    .references(() => campaign.id, { onDelete: 'cascade' }),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  originalName: text('original_name').notNull(),
  sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
  contentType: text('content_type').notNull(),
  storageProvider: text('storage_provider').notNull(),
  storageKey: text('storage_key').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
