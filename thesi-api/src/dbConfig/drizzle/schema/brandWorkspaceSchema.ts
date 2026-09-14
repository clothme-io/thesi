import { pgSchema, text, timestamp, uuid, primaryKey } from 'drizzle-orm/pg-core';
import { thesiUser } from './userSchema';

const thesi = pgSchema('thesi');

// Additive foundation. Creator CRM workspaces remain independent.
export const brandWorkspace = thesi.table('brand_workspace', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerUserId: text('owner_user_id').notNull().references(() => thesiUser.id, { onDelete: 'restrict' }),
  creationKey: uuid('creation_key'),
  legacyOwnerUserId: text('legacy_owner_user_id').unique()
    .references(() => thesiUser.id, { onDelete: 'restrict' }),
  name: text('name').notNull(),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const brandWorkspaceMember = thesi.table('brand_workspace_member', {
  workspaceId: uuid('workspace_id').notNull()
    .references(() => brandWorkspace.id, { onDelete: 'restrict' }),
  userId: text('user_id').notNull()
    .references(() => thesiUser.id, { onDelete: 'restrict' }),
  role: text('role').notNull().default('owner'),
  status: text('status').notNull().default('active'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.workspaceId, table.userId] })]);
