import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const thesiUser = pgTable('thesi_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull(), // creator | brand | admin
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  creatorApplicationId: text('creator_application_id'),
  stripeConnectAccountId: text('stripe_connect_account_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
