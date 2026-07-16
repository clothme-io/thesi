import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { thesiUser } from './userSchema';

export const thesiRefreshToken = pgTable('thesi_refresh_tokens', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  revokedAt: timestamp('revoked_at'),
});
