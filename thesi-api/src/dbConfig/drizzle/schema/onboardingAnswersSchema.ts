import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { thesiUser } from './userSchema';

export const thesiOnboardingAnswers = pgTable('thesi_onboarding_answers', {
  userId: text('user_id')
    .primaryKey()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  contentType: text('content_type'),
  monthlyProjects: text('monthly_projects'),
  preferredPayment: text('preferred_payment'),
  biggestChallenge: text('biggest_challenge'),
  hearAbout: text('hear_about'),
  companySize: text('company_size'),
  monthlyCampaigns: text('monthly_campaigns'),
  primaryGoal: text('primary_goal'),
  budgetRange: text('budget_range'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
