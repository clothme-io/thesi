import {
  boolean,
  pgSchema,
  text,
  timestamp,
  uuid,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export const inboxThread = thesiSchema.table('inbox_thread', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandUserId: text('brand_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  creatorUserId: text('creator_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inboxMessage = thesiSchema.table('inbox_message', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => inboxThread.id, { onDelete: 'cascade' }),
  senderUserId: text('sender_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  content: text('content').notNull(),
  kind: text('kind').notNull().default('message'),
  campaignId: text('campaign_id'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const inboxMessageState = thesiSchema.table(
  'inbox_message_state',
  {
    messageId: uuid('message_id')
      .notNull()
      .references(() => inboxMessage.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => thesiUser.id, { onDelete: 'cascade' }),
    read: boolean('read').notNull().default(false),
    deleted: boolean('deleted').notNull().default(false),
  },
  (table) => [primaryKey({ columns: [table.messageId, table.userId] })],
);

export const inboxNotification = thesiSchema.table('inbox_notification', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  href: text('href'),
  campaignId: text('campaign_id'),
  audience: text('audience').notNull(),
  read: boolean('read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
