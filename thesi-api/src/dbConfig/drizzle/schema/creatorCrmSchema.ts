import {
  boolean,
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

export const crmBrandPerson = thesiSchema.table('crm_brand_person', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  brandId: uuid('brand_id')
    .notNull()
    .references(() => crmBrand.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  email: text('email').notNull().default(''),
  phone: text('phone').notNull().default(''),
  roleTitle: text('role_title').notNull().default(''),
  isPrimary: boolean('is_primary').notNull().default(false),
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
  primaryContactId: uuid('primary_contact_id').references(
    () => crmBrandPerson.id,
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
  storageProvider: text('storage_provider'),
  storageKey: text('storage_key'),
  contentType: text('content_type'),
  sizeBytes: integer('size_bytes'),
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
  body: text('body').notNull().default(''),
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

export type CrmFieldType = 'text' | 'number' | 'date' | 'boolean' | 'select';
export type CrmFieldTargetType = 'brand' | 'deal' | 'job' | 'custom_object';
export type CrmWorkflowTriggerType =
  | 'deal_stage_changed'
  | 'deal_created'
  | 'payment_status_changed'
  | 'task_created'
  | 'custom_record_created';
export type CrmWorkflowActionType =
  | 'create_task'
  | 'create_activity'
  | 'set_entity_field';

export const crmCustomObject = thesiSchema.table('crm_custom_object', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  apiName: text('api_name').notNull(),
  description: text('description').notNull().default(''),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmCustomField = thesiSchema.table('crm_custom_field', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  targetType: text('target_type').notNull(),
  targetObjectId: uuid('target_object_id').references(() => crmCustomObject.id, {
    onDelete: 'cascade',
  }),
  name: text('name').notNull(),
  apiName: text('api_name').notNull(),
  fieldType: text('field_type').notNull(),
  options: jsonb('options').$type<string[]>().notNull().default([]),
  required: boolean('required').notNull().default(false),
  position: integer('position').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmEntityFieldValues = thesiSchema.table('crm_entity_field_values', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  entityType: text('entity_type').notNull(),
  entityId: uuid('entity_id').notNull(),
  values: jsonb('values').$type<Record<string, string | number | boolean | null>>().notNull().default({}),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmCustomRecord = thesiSchema.table('crm_custom_record', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  objectId: uuid('object_id')
    .notNull()
    .references(() => crmCustomObject.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  values: jsonb('values').$type<Record<string, string | number | boolean | null>>().notNull().default({}),
  brandId: uuid('brand_id').references(() => crmBrand.id, {
    onDelete: 'set null',
  }),
  dealId: uuid('deal_id').references(() => crmDeal.id, {
    onDelete: 'set null',
  }),
  jobId: uuid('job_id').references(() => crmJob.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmWorkflow = thesiSchema.table('crm_workflow', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  enabled: boolean('enabled').notNull().default(true),
  triggerType: text('trigger_type').notNull(),
  triggerConfig: jsonb('trigger_config')
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmWorkflowAction = thesiSchema.table('crm_workflow_action', {
  id: uuid('id').primaryKey().defaultRandom(),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  workflowId: uuid('workflow_id')
    .notNull()
    .references(() => crmWorkflow.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(0),
  actionType: text('action_type').notNull(),
  actionConfig: jsonb('action_config')
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmWorkspace = thesiSchema.table('crm_workspace', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: text('owner_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  name: text('name').notNull().default('My CRM'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmWorkspaceMember = thesiSchema.table('crm_workspace_member', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => crmWorkspace.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => thesiUser.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull().default('member'),
  status: text('status').notNull().default('invited'),
  invitedByUserId: text('invited_by_user_id').references(() => thesiUser.id, {
    onDelete: 'set null',
  }),
  inviteToken: text('invite_token'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmIntegrationConnection = thesiSchema.table(
  'crm_integration_connection',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => crmWorkspace.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    accountEmail: text('account_email').notNull().default(''),
    status: text('status').notNull().default('disconnected'),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastError: text('last_error').notNull().default(''),
    connectedByUserId: text('connected_by_user_id').references(() => thesiUser.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

export const crmSyncedEmail = thesiSchema.table('crm_synced_email', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => crmWorkspace.id, { onDelete: 'cascade' }),
  connectionId: uuid('connection_id')
    .notNull()
    .references(() => crmIntegrationConnection.id, { onDelete: 'cascade' }),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  externalMessageId: text('external_message_id').notNull(),
  direction: text('direction').notNull().default('inbound'),
  fromEmail: text('from_email').notNull().default(''),
  toEmail: text('to_email').notNull().default(''),
  subject: text('subject').notNull().default(''),
  snippet: text('snippet').notNull().default(''),
  sentAt: timestamp('sent_at', { withTimezone: true }).notNull().defaultNow(),
  brandId: uuid('brand_id').references(() => crmBrand.id, { onDelete: 'set null' }),
  activityId: uuid('activity_id').references(() => crmActivity.id, {
    onDelete: 'set null',
  }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmSyncedCalendarEvent = thesiSchema.table('crm_synced_calendar_event', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => crmWorkspace.id, { onDelete: 'cascade' }),
  connectionId: uuid('connection_id')
    .notNull()
    .references(() => crmIntegrationConnection.id, { onDelete: 'cascade' }),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  externalEventId: text('external_event_id').notNull(),
  title: text('title').notNull(),
  startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  endsAt: timestamp('ends_at', { withTimezone: true }),
  location: text('location').notNull().default(''),
  brandId: uuid('brand_id').references(() => crmBrand.id, { onDelete: 'set null' }),
  jobId: uuid('job_id').references(() => crmJob.id, { onDelete: 'set null' }),
  crmCalendarEventId: uuid('crm_calendar_event_id').references(
    () => crmCalendarEvent.id,
    { onDelete: 'set null' },
  ),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const crmIntegrationSyncRun = thesiSchema.table('crm_integration_sync_run', {
  id: uuid('id').primaryKey().defaultRandom(),
  connectionId: uuid('connection_id')
    .notNull()
    .references(() => crmIntegrationConnection.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('queued'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  stats: jsonb('stats').$type<Record<string, unknown>>().notNull().default({}),
  error: text('error').notNull().default(''),
});
