import { Inject, Injectable } from '@nestjs/common';
import { desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type {
  SupportMessageRecord,
  SupportRepository,
  SupportThreadRecord,
  SupportUser,
} from './support.repository';

@Injectable()
export class PostgresSupportRepository implements SupportRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string): Promise<SupportUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return user ?? null;
  }

  async listThreadsForUser(userId: string): Promise<SupportThreadRecord[]> {
    const rows = await this.db
      .select({
        id: schema.supportThread.id,
        userId: schema.supportThread.userId,
        subject: schema.supportThread.subject,
        status: schema.supportThread.status,
        createdAt: schema.supportThread.createdAt,
        updatedAt: schema.supportThread.updatedAt,
        lastMessage: sql<string | null>`(
          SELECT message.content
          FROM thesi.support_message AS message
          WHERE message.thread_id = ${schema.supportThread.id}
          ORDER BY message.created_at DESC
          LIMIT 1
        )`,
      })
      .from(schema.supportThread)
      .where(eq(schema.supportThread.userId, userId))
      .orderBy(desc(schema.supportThread.updatedAt));

    return rows.map((row) => mapThread(row));
  }

  async getThreadForUser(
    userId: string,
    threadId: string,
  ): Promise<SupportThreadRecord | null> {
    const [row] = await this.db
      .select({
        id: schema.supportThread.id,
        userId: schema.supportThread.userId,
        subject: schema.supportThread.subject,
        status: schema.supportThread.status,
        createdAt: schema.supportThread.createdAt,
        updatedAt: schema.supportThread.updatedAt,
        lastMessage: sql<string | null>`(
          SELECT message.content
          FROM thesi.support_message AS message
          WHERE message.thread_id = ${schema.supportThread.id}
          ORDER BY message.created_at DESC
          LIMIT 1
        )`,
      })
      .from(schema.supportThread)
      .where(
        sql`${schema.supportThread.id} = ${threadId}::uuid AND ${schema.supportThread.userId} = ${userId}`,
      )
      .limit(1);
    return row ? mapThread(row) : null;
  }

  async listMessagesForThread(
    userId: string,
    threadId: string,
  ): Promise<SupportMessageRecord[]> {
    const rows = await this.db
      .select({
        id: schema.supportMessage.id,
        threadId: schema.supportMessage.threadId,
        senderUserId: schema.supportMessage.senderUserId,
        senderType: schema.supportMessage.senderType,
        content: schema.supportMessage.content,
        createdAt: schema.supportMessage.createdAt,
      })
      .from(schema.supportMessage)
      .innerJoin(
        schema.supportThread,
        eq(schema.supportThread.id, schema.supportMessage.threadId),
      )
      .where(
        sql`${schema.supportMessage.threadId} = ${threadId}::uuid AND ${schema.supportThread.userId} = ${userId}`,
      )
      .orderBy(schema.supportMessage.createdAt);

    return rows.map((row) => mapMessage(row));
  }

  async createThread(input: {
    userId: string;
    subject: string;
    content: string;
  }): Promise<{
    thread: SupportThreadRecord;
    message: SupportMessageRecord;
  }> {
    const [thread] = await this.db
      .insert(schema.supportThread)
      .values({
        userId: input.userId,
        subject: input.subject,
        status: 'open',
      })
      .returning();
    const [message] = await this.db
      .insert(schema.supportMessage)
      .values({
        threadId: thread.id,
        senderUserId: input.userId,
        senderType: 'user',
        content: input.content,
      })
      .returning();
    return {
      thread: mapThread({ ...thread, lastMessage: message.content }),
      message: mapMessage(message),
    };
  }

  async createMessage(input: {
    userId: string;
    threadId: string;
    content: string;
  }): Promise<SupportMessageRecord> {
    const [message] = await this.db
      .insert(schema.supportMessage)
      .values({
        threadId: input.threadId,
        senderUserId: input.userId,
        senderType: 'user',
        content: input.content,
      })
      .returning();
    await this.db
      .update(schema.supportThread)
      .set({ updatedAt: new Date(), status: 'open' })
      .where(eq(schema.supportThread.id, input.threadId));
    return mapMessage(message);
  }
}

function mapThread(row: {
  id: string;
  userId: string;
  subject: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  lastMessage?: string | null;
}): SupportThreadRecord {
  return {
    id: row.id,
    userId: row.userId,
    subject: row.subject,
    status: row.status as SupportThreadRecord['status'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(row.lastMessage ? { lastMessage: row.lastMessage } : {}),
    unreadCount: 0,
  };
}

function mapMessage(row: {
  id: string;
  threadId: string;
  senderUserId: string | null;
  senderType: string;
  content: string;
  createdAt: Date;
}): SupportMessageRecord {
  return {
    id: row.id,
    threadId: row.threadId,
    senderUserId: row.senderUserId,
    senderType: row.senderType as SupportMessageRecord['senderType'],
    content: row.content,
    createdAt: row.createdAt.toISOString(),
  };
}
