import {
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
  date,
  uuid,
} from 'drizzle-orm/pg-core';
import { marketplaceListing } from './marketplaceSchema';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export const crmBrand = thesiSchema.table('crm_brand', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  contactName: text('contact_name').notNull().default(''),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  website: text('website').notNull().default(''),
  relationshipStage: text('relationship_stage').notNull().default('prospect'),
  tags: jsonb('tags').$type<string[]>().notNull().default([]),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmDeal = thesiSchema.table('crm_deal', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => crmBrand.id, { onDelete: 'cascade' }),
  marketplaceListingId: uuid('marketplace_listing_id').references(
    () => marketplaceListing.id,
    { onDelete: 'set null' },
  ),
  title: text('title').notNull(),
  valueCents: integer('value_cents').notNull().default(0),
  stage: text('stage').notNull().default('lead'),
  expectedCloseDate: date('expected_close_date'),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmContract = thesiSchema.table('crm_contract', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => crmBrand.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id'),
  title: text('title').notNull(),
  status: text('status').notNull().default('draft'),
  fileName: text('file_name'),
  signedAt: timestamp('signed_at', { withTimezone: true }),
  expiresAt: date('expires_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmJob = thesiSchema.table('crm_job', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => crmBrand.id, { onDelete: 'cascade' }),
  dealId: uuid('deal_id')
    .notNull()
    .references(() => crmDeal.id, { onDelete: 'cascade' }),
  contractId: uuid('contract_id').references(() => crmContract.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  deliverables: text('deliverables').notNull().default(''),
  deadline: date('deadline'),
  status: text('status').notNull().default('active'),
  paymentStatus: text('payment_status').notNull().default('unpaid'),
  amountCents: integer('amount_cents').notNull().default(0),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmPayment = thesiSchema.table('crm_payment', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => crmBrand.id, { onDelete: 'cascade' }),
  jobId: uuid('job_id')
    .notNull()
    .references(() => crmJob.id, { onDelete: 'cascade' }),
  amountCents: integer('amount_cents').notNull().default(0),
  status: text('status').notNull().default('unpaid'),
  dueDate: date('due_date'),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  invoiceNumber: text('invoice_number'),
  description: text('description').notNull().default(''),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmCalendarEvent = thesiSchema.table('crm_calendar_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  brandId: uuid('brand_id').references(() => crmBrand.id, {
    onDelete: 'set null',
  }),
  jobId: uuid('job_id').references(() => crmJob.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  type: text('type').notNull(),
  date: date('date').notNull(),
  notes: text('notes').notNull().default(''),
});

export const crmTask = thesiSchema.table('crm_task', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  brandId: uuid('brand_id').references(() => crmBrand.id, {
    onDelete: 'set null',
  }),
  jobId: uuid('job_id').references(() => crmJob.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  dueDate: date('due_date'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmActivity = thesiSchema.table('crm_activity', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  brandId: uuid('brand_id').references(() => crmBrand.id, {
    onDelete: 'set null',
  }),
  jobId: uuid('job_id').references(() => crmJob.id, { onDelete: 'set null' }),
  dealId: uuid('deal_id').references(() => crmDeal.id, { onDelete: 'set null' }),
  type: text('type').notNull(),
  message: text('message').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
