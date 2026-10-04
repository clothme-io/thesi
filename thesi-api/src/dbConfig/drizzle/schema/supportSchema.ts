import {
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export const supportThread = thesiSchema.table('support_thread', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  subject: text('subject').notNull(),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const supportMessage = thesiSchema.table('support_message', {
  id: uuid('id').primaryKey().defaultRandom(),
  threadId: uuid('thread_id')
    .notNull()
    .references(() => supportThread.id, { onDelete: 'cascade' }),
  senderUserId: text('sender_user_id').references(() => thesiUser.id, {
    onDelete: 'set null',
  }),
  senderType: text('sender_type').notNull().default('user'),
  content: text('content').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});
