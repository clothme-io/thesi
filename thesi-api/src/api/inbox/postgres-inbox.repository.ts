import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type {
  CreateMessageInput,
  CreateNotificationInput,
  InboxNotificationRecord,
  InboxRepository,
  InboxUser,
} from './inbox.repository';

@Injectable()
export class PostgresInboxRepository implements InboxRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string): Promise<InboxUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
        email: schema.thesiUser.email,
        fullName: schema.thesiUser.fullName,
        companyName: schema.thesiUser.companyName,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return user ?? null;
  }

  async findUserByEmail(email: string): Promise<InboxUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
        email: schema.thesiUser.email,
        fullName: schema.thesiUser.fullName,
        companyName: schema.thesiUser.companyName,
      })
      .from(schema.thesiUser)
      .where(sql`lower(${schema.thesiUser.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return user ?? null;
  }

  async listThreadsForUser(userId: string) {
    return this.db
      .select({
        id: schema.inboxThread.id,
        brandUserId: schema.inboxThread.brandUserId,
        creatorUserId: schema.inboxThread.creatorUserId,
      })
      .from(schema.inboxThread)
      .where(
        or(
          eq(schema.inboxThread.brandUserId, userId),
          eq(schema.inboxThread.creatorUserId, userId),
        ),
      )
      .orderBy(desc(schema.inboxThread.updatedAt));
  }

  async getThreadForUser(userId: string, threadId: string) {
    const [thread] = await this.db
      .select({
        id: schema.inboxThread.id,
        brandUserId: schema.inboxThread.brandUserId,
        creatorUserId: schema.inboxThread.creatorUserId,
      })
      .from(schema.inboxThread)
      .where(
        and(
          eq(schema.inboxThread.id, threadId),
          or(
            eq(schema.inboxThread.brandUserId, userId),
            eq(schema.inboxThread.creatorUserId, userId),
          ),
        ),
      )
      .limit(1);
    return thread ?? null;
  }

  async ensureThread(brandUserId: string, creatorUserId: string) {
    const [existing] = await this.db
      .select({
        id: schema.inboxThread.id,
        brandUserId: schema.inboxThread.brandUserId,
        creatorUserId: schema.inboxThread.creatorUserId,
      })
      .from(schema.inboxThread)
      .where(
        and(
          eq(schema.inboxThread.brandUserId, brandUserId),
          eq(schema.inboxThread.creatorUserId, creatorUserId),
        ),
      )
      .limit(1);
    if (existing) return existing;

    const [created] = await this.db
      .insert(schema.inboxThread)
      .values({ brandUserId, creatorUserId })
      .returning({
        id: schema.inboxThread.id,
        brandUserId: schema.inboxThread.brandUserId,
        creatorUserId: schema.inboxThread.creatorUserId,
      });
    return created;
  }

  async getContactDisplay(viewerUserId: string, peerUserId: string) {
    const peer = await this.getUser(peerUserId);
    if (!peer) {
      return { name: 'Unknown', email: '' };
    }

    if (peer.role === 'brand') {
      const [profile] = await this.db
        .select({ companyName: schema.brandProfile.companyName })
        .from(schema.brandProfile)
        .where(eq(schema.brandProfile.userId, peerUserId))
        .limit(1);
      const company =
        profile?.companyName || peer.companyName || peer.fullName;
      return {
        name: peer.fullName,
        email: peer.email,
        company,
        brandId: peerUserId,
      };
    }

    const [profile] = await this.db
      .select({ displayName: schema.creatorProfile.displayName })
      .from(schema.creatorProfile)
      .where(eq(schema.creatorProfile.userId, peerUserId))
      .limit(1);
    return {
      name: profile?.displayName || peer.fullName,
      email: peer.email,
      company: peer.role === 'creator' ? 'Creator' : undefined,
    };
  }

  async listMessagesForUser(userId: string) {
    const rows = await this.db
      .select({
        id: schema.inboxMessage.id,
        threadId: schema.inboxMessage.threadId,
        senderUserId: schema.inboxMessage.senderUserId,
        subject: schema.inboxMessage.subject,
        content: schema.inboxMessage.content,
        kind: schema.inboxMessage.kind,
        campaignId: schema.inboxMessage.campaignId,
        createdAt: schema.inboxMessage.createdAt,
        read: schema.inboxMessageState.read,
        deleted: schema.inboxMessageState.deleted,
      })
      .from(schema.inboxMessage)
      .innerJoin(
        schema.inboxMessageState,
        and(
          eq(schema.inboxMessageState.messageId, schema.inboxMessage.id),
          eq(schema.inboxMessageState.userId, userId),
        ),
      )
      .where(eq(schema.inboxMessageState.deleted, false))
      .orderBy(asc(schema.inboxMessage.createdAt));

    return rows.map((row) => ({
      id: row.id,
      threadId: row.threadId,
      senderUserId: row.senderUserId,
      subject: row.subject,
      content: row.content,
      kind: row.kind as 'message' | 'invite',
      campaignId: row.campaignId,
      createdAt: row.createdAt.toISOString(),
      read: row.read,
    }));
  }

  async createMessage(input: CreateMessageInput) {
    const [message] = await this.db
      .insert(schema.inboxMessage)
      .values({
        threadId: input.threadId,
        senderUserId: input.senderUserId,
        subject: input.subject,
        content: input.content,
        kind: input.kind ?? 'message',
        campaignId: input.campaignId,
      })
      .returning();

    await this.db.insert(schema.inboxMessageState).values([
      {
        messageId: message.id,
        userId: input.senderUserId,
        read: true,
        deleted: false,
      },
      {
        messageId: message.id,
        userId: input.recipientUserId,
        read: false,
        deleted: false,
      },
    ]);

    await this.db
      .update(schema.inboxThread)
      .set({ updatedAt: new Date() })
      .where(eq(schema.inboxThread.id, input.threadId));

    return {
      id: message.id,
      threadId: message.threadId,
      senderUserId: message.senderUserId,
      subject: message.subject,
      content: message.content,
      kind: message.kind as 'message' | 'invite',
      campaignId: message.campaignId,
      createdAt: message.createdAt.toISOString(),
    };
  }

  async markThreadRead(userId: string, threadId: string): Promise<void> {
    await this.db.execute(sql`
      UPDATE thesi.inbox_message_state AS state
      SET read = true
      FROM thesi.inbox_message AS message
      WHERE state.message_id = message.id
        AND state.user_id = ${userId}
        AND message.thread_id = ${threadId}::uuid
        AND message.sender_user_id <> ${userId}
        AND state.deleted = false
    `);
  }

  async softDeleteMessage(userId: string, messageId: string): Promise<boolean> {
    const [updated] = await this.db
      .update(schema.inboxMessageState)
      .set({ deleted: true })
      .where(
        and(
          eq(schema.inboxMessageState.messageId, messageId),
          eq(schema.inboxMessageState.userId, userId),
        ),
      )
      .returning({ messageId: schema.inboxMessageState.messageId });
    return Boolean(updated);
  }

  async listNotifications(
    userId: string,
  ): Promise<InboxNotificationRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.inboxNotification)
      .where(eq(schema.inboxNotification.userId, userId))
      .orderBy(desc(schema.inboxNotification.createdAt));
    return rows.map(mapNotification);
  }

  async createNotification(
    input: CreateNotificationInput,
  ): Promise<InboxNotificationRecord> {
    const [row] = await this.db
      .insert(schema.inboxNotification)
      .values({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href,
        campaignId: input.campaignId,
        audience: input.audience,
      })
      .returning();
    return mapNotification(row);
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<boolean> {
    const [updated] = await this.db
      .update(schema.inboxNotification)
      .set({ read: true })
      .where(
        and(
          eq(schema.inboxNotification.id, notificationId),
          eq(schema.inboxNotification.userId, userId),
        ),
      )
      .returning({ id: schema.inboxNotification.id });
    return Boolean(updated);
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.db
      .update(schema.inboxNotification)
      .set({ read: true })
      .where(eq(schema.inboxNotification.userId, userId));
  }
}

function mapNotification(
  row: typeof schema.inboxNotification.$inferSelect,
): InboxNotificationRecord {
  return {
    id: row.id,
    type: row.type as InboxNotificationRecord['type'],
    title: row.title,
    body: row.body,
    createdAt: row.createdAt.toISOString(),
    read: row.read,
    ...(row.href ? { href: row.href } : {}),
    ...(row.campaignId ? { campaignId: row.campaignId } : {}),
    audience: row.audience as InboxNotificationRecord['audience'],
  };
}
