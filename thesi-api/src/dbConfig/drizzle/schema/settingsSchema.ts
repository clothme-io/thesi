import {
  boolean,
  pgSchema,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export const userSettings = thesiSchema.table('user_settings', {
  userId: text('user_id')
    .primaryKey()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  timezone: text('timezone').notNull().default('America/Los_Angeles'),
  dateFormat: text('date_format').notNull().default('mdy'),
  compactSidebar: boolean('compact_sidebar').notNull().default(false),
  emailNotifications: boolean('email_notifications').notNull().default(true),
  paymentReminders: boolean('payment_reminders').notNull().default(true),
  marketingEmails: boolean('marketing_emails').notNull().default(false),
  dealUpdates: boolean('deal_updates').notNull().default(true),
  taskReminders: boolean('task_reminders').notNull().default(true),
  campaignUpdates: boolean('campaign_updates').notNull().default(true),
  creatorApplications: boolean('creator_applications').notNull().default(true),
  marketplaceActivity: boolean('marketplace_activity').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
