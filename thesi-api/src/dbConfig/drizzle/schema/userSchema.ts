import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const thesiUser = pgTable('thesi_users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  fullName: text('full_name').notNull(),
  companyName: text('company_name'),
  role: text('role').notNull(), // creator | brand | admin
  mustChangePassword: boolean('must_change_password').notNull().default(false),
  onboardingCompleted: boolean('onboarding_completed').notNull().default(false),
  onboardingStep: text('onboarding_step').notNull().default('welcome'),
  creatorApplicationId: text('creator_application_id'),
  stripeConnectAccountId: text('stripe_connect_account_id'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
