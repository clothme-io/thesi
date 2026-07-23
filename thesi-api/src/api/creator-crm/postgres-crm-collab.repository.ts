import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { randomBytes } from 'crypto';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export type CrmWorkspaceDto = {
  id: string;
  ownerUserId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmWorkspaceMemberDto = {
  id: string;
  workspaceId: string;
  userId?: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'active' | 'invited' | 'removed';
  inviteToken?: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmIntegrationConnectionDto = {
  id: string;
  workspaceId: string;
  provider:
    | 'gmail'
    | 'google_calendar'
    | 'microsoft_mail'
    | 'microsoft_calendar';
  accountEmail: string;
  status: 'disconnected' | 'connected' | 'error' | 'stub';
  scopes: string[];
  lastSyncAt?: string;
  lastError: string;
  createdAt: string;
  updatedAt: string;
};

export type CrmSyncedEmailDto = {
  id: string;
  connectionId: string;
  direction: 'inbound' | 'outbound';
  fromEmail: string;
  toEmail: string;
  subject: string;
  snippet: string;
  sentAt: string;
  brandId?: string;
};

export type CrmSyncedCalendarDto = {
  id: string;
  connectionId: string;
  title: string;
  startsAt: string;
  endsAt?: string;
  location: string;
  brandId?: string;
  jobId?: string;
};

export type CrmCollabSnapshot = {
  workspace: CrmWorkspaceDto;
  members: CrmWorkspaceMemberDto[];
  connections: CrmIntegrationConnectionDto[];
  syncedEmails: CrmSyncedEmailDto[];
  syncedCalendarEvents: CrmSyncedCalendarDto[];
};

@Injectable()
export class PostgresCrmCollabRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string) {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
        email: schema.thesiUser.email,
        fullName: schema.thesiUser.fullName,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return user ?? null;
  }

  async findUserByEmail(email: string) {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
        email: schema.thesiUser.email,
        fullName: schema.thesiUser.fullName,
      })
      .from(schema.thesiUser)
      .where(sql`lower(${schema.thesiUser.email}) = ${email.toLowerCase()}`)
      .limit(1);
    return user ?? null;
  }

  async ensureWorkspace(ownerUserId: string, name?: string) {
    const existing = await this.getWorkspaceByOwner(ownerUserId);
    if (existing) return existing;
    const [row] = await this.db
      .insert(schema.crmWorkspace)
      .values({
        ownerUserId,
        name: name?.trim() || 'My CRM',
      })
      .returning();
    await this.db.insert(schema.crmWorkspaceMember).values({
      workspaceId: row.id,
      userId: ownerUserId,
      email: (await this.getUser(ownerUserId))?.email?.toLowerCase() || ownerUserId,
      role: 'owner',
      status: 'active',
      invitedByUserId: ownerUserId,
    });
    return this.toWorkspace(row);
  }

  async getWorkspaceByOwner(ownerUserId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmWorkspace)
      .where(eq(schema.crmWorkspace.ownerUserId, ownerUserId))
      .limit(1);
    return row ? this.toWorkspace(row) : null;
  }

  async getWorkspace(workspaceId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmWorkspace)
      .where(eq(schema.crmWorkspace.id, workspaceId))
      .limit(1);
    return row ? this.toWorkspace(row) : null;
  }

  async updateWorkspaceName(workspaceId: string, name: string) {
    const [row] = await this.db
      .update(schema.crmWorkspace)
      .set({ name, updatedAt: new Date() })
      .where(eq(schema.crmWorkspace.id, workspaceId))
      .returning();
    return row ? this.toWorkspace(row) : null;
  }

  async listMembers(workspaceId: string) {
    const rows = await this.db
      .select()
      .from(schema.crmWorkspaceMember)
      .where(eq(schema.crmWorkspaceMember.workspaceId, workspaceId))
      .orderBy(desc(schema.crmWorkspaceMember.createdAt));
    return rows.map((row) => this.toMember(row));
  }

  async findMembershipForUser(userId: string, email: string) {
    const rows = await this.db
      .select()
      .from(schema.crmWorkspaceMember)
      .where(
        and(
          eq(schema.crmWorkspaceMember.status, 'active'),
          or(
            eq(schema.crmWorkspaceMember.userId, userId),
            sql`lower(${schema.crmWorkspaceMember.email}) = ${email.toLowerCase()}`,
          ),
        ),
      );
    return rows.map((row) => this.toMember(row));
  }

  async createInvite(input: {
    workspaceId: string;
    email: string;
    role: CrmWorkspaceMemberDto['role'];
    invitedByUserId: string;
  }) {
    const token = randomBytes(24).toString('hex');
    const [row] = await this.db
      .insert(schema.crmWorkspaceMember)
      .values({
        workspaceId: input.workspaceId,
        email: input.email.trim().toLowerCase(),
        role: input.role,
        status: 'invited',
        invitedByUserId: input.invitedByUserId,
        inviteToken: token,
      })
      .onConflictDoUpdate({
        target: [
          schema.crmWorkspaceMember.workspaceId,
          schema.crmWorkspaceMember.email,
        ],
        set: {
          role: input.role,
          status: 'invited',
          inviteToken: token,
          invitedByUserId: input.invitedByUserId,
          updatedAt: new Date(),
        },
      })
      .returning();
    return this.toMember(row);
  }

  async acceptInvite(token: string, userId: string, email: string) {
    const [row] = await this.db
      .update(schema.crmWorkspaceMember)
      .set({
        status: 'active',
        userId,
        email: email.toLowerCase(),
        inviteToken: null,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.crmWorkspaceMember.inviteToken, token),
          eq(schema.crmWorkspaceMember.status, 'invited'),
        ),
      )
      .returning();
    return row ? this.toMember(row) : null;
  }

  async removeMember(workspaceId: string, memberId: string) {
    const [row] = await this.db
      .update(schema.crmWorkspaceMember)
      .set({ status: 'removed', updatedAt: new Date() })
      .where(
        and(
          eq(schema.crmWorkspaceMember.workspaceId, workspaceId),
          eq(schema.crmWorkspaceMember.id, memberId),
        ),
      )
      .returning();
    return row ? this.toMember(row) : null;
  }

  async listConnections(workspaceId: string) {
    const rows = await this.db
      .select()
      .from(schema.crmIntegrationConnection)
      .where(eq(schema.crmIntegrationConnection.workspaceId, workspaceId));
    return rows.map((row) => this.toConnection(row));
  }

  async ensureDefaultConnections(workspaceId: string) {
    const existing = await this.listConnections(workspaceId);
    const providers: CrmIntegrationConnectionDto['provider'][] = [
      'gmail',
      'google_calendar',
      'microsoft_mail',
      'microsoft_calendar',
    ];
    for (const provider of providers) {
      if (existing.some((row) => row.provider === provider)) continue;
      await this.db.insert(schema.crmIntegrationConnection).values({
        workspaceId,
        provider,
        status: 'disconnected',
      });
    }
    return this.listConnections(workspaceId);
  }

  async getConnection(workspaceId: string, connectionId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmIntegrationConnection)
      .where(
        and(
          eq(schema.crmIntegrationConnection.workspaceId, workspaceId),
          eq(schema.crmIntegrationConnection.id, connectionId),
        ),
      )
      .limit(1);
    return row ? this.toConnection(row) : null;
  }

  async connectProvider(input: {
    workspaceId: string;
    connectionId: string;
    accountEmail: string;
    userId: string;
  }) {
    const [row] = await this.db
      .update(schema.crmIntegrationConnection)
      .set({
        accountEmail: input.accountEmail.trim().toLowerCase(),
        status: 'stub',
        scopes: ['mail.read', 'calendar.read'],
        connectedByUserId: input.userId,
        lastError: '',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.crmIntegrationConnection.workspaceId, input.workspaceId),
          eq(schema.crmIntegrationConnection.id, input.connectionId),
        ),
      )
      .returning();
    return row ? this.toConnection(row) : null;
  }

  async disconnectProvider(workspaceId: string, connectionId: string) {
    const [row] = await this.db
      .update(schema.crmIntegrationConnection)
      .set({
        status: 'disconnected',
        accountEmail: '',
        lastError: '',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.crmIntegrationConnection.workspaceId, workspaceId),
          eq(schema.crmIntegrationConnection.id, connectionId),
        ),
      )
      .returning();
    return row ? this.toConnection(row) : null;
  }

  async markSynced(
    connectionId: string,
    patch: { lastSyncAt: Date; lastError?: string; status?: string },
  ) {
    await this.db
      .update(schema.crmIntegrationConnection)
      .set({
        lastSyncAt: patch.lastSyncAt,
        ...(patch.lastError !== undefined ? { lastError: patch.lastError } : {}),
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.crmIntegrationConnection.id, connectionId));
  }

  async createSyncRun(connectionId: string) {
    const [row] = await this.db
      .insert(schema.crmIntegrationSyncRun)
      .values({
        connectionId,
        status: 'running',
      })
      .returning();
    return row;
  }

  async finishSyncRun(
    runId: string,
    patch: {
      status: 'succeeded' | 'failed';
      stats: Record<string, unknown>;
      error?: string;
    },
  ) {
    await this.db
      .update(schema.crmIntegrationSyncRun)
      .set({
        status: patch.status,
        finishedAt: new Date(),
        stats: patch.stats,
        error: patch.error ?? '',
      })
      .where(eq(schema.crmIntegrationSyncRun.id, runId));
  }

  async insertSyncedEmail(input: {
    workspaceId: string;
    connectionId: string;
    creatorUserId: string;
    externalMessageId: string;
    direction: 'inbound' | 'outbound';
    fromEmail: string;
    toEmail: string;
    subject: string;
    snippet: string;
    brandId?: string | null;
    activityId?: string | null;
  }) {
    const [row] = await this.db
      .insert(schema.crmSyncedEmail)
      .values({
        workspaceId: input.workspaceId,
        connectionId: input.connectionId,
        creatorUserId: input.creatorUserId,
        externalMessageId: input.externalMessageId,
        direction: input.direction,
        fromEmail: input.fromEmail,
        toEmail: input.toEmail,
        subject: input.subject,
        snippet: input.snippet,
        brandId: input.brandId ?? null,
        activityId: input.activityId ?? null,
      })
      .onConflictDoNothing()
      .returning();
    return row
      ? {
          id: row.id,
          connectionId: row.connectionId,
          direction: row.direction as 'inbound' | 'outbound',
          fromEmail: row.fromEmail,
          toEmail: row.toEmail,
          subject: row.subject,
          snippet: row.snippet,
          sentAt: iso(row.sentAt),
          ...(row.brandId ? { brandId: row.brandId } : {}),
        }
      : null;
  }

  async insertSyncedCalendarEvent(input: {
    workspaceId: string;
    connectionId: string;
    creatorUserId: string;
    externalEventId: string;
    title: string;
    startsAt: Date;
    endsAt?: Date | null;
    location?: string;
    brandId?: string | null;
    jobId?: string | null;
    crmCalendarEventId?: string | null;
  }) {
    const [row] = await this.db
      .insert(schema.crmSyncedCalendarEvent)
      .values({
        workspaceId: input.workspaceId,
        connectionId: input.connectionId,
        creatorUserId: input.creatorUserId,
        externalEventId: input.externalEventId,
        title: input.title,
        startsAt: input.startsAt,
        endsAt: input.endsAt ?? null,
        location: input.location ?? '',
        brandId: input.brandId ?? null,
        jobId: input.jobId ?? null,
        crmCalendarEventId: input.crmCalendarEventId ?? null,
      })
      .onConflictDoNothing()
      .returning();
    return row
      ? {
          id: row.id,
          connectionId: row.connectionId,
          title: row.title,
          startsAt: iso(row.startsAt),
          ...(row.endsAt ? { endsAt: iso(row.endsAt) } : {}),
          location: row.location,
          ...(row.brandId ? { brandId: row.brandId } : {}),
          ...(row.jobId ? { jobId: row.jobId } : {}),
        }
      : null;
  }

  async listSyncedEmails(workspaceId: string) {
    const rows = await this.db
      .select()
      .from(schema.crmSyncedEmail)
      .where(eq(schema.crmSyncedEmail.workspaceId, workspaceId))
      .orderBy(desc(schema.crmSyncedEmail.sentAt))
      .limit(50);
    return rows.map((row) => ({
      id: row.id,
      connectionId: row.connectionId,
      direction: row.direction as 'inbound' | 'outbound',
      fromEmail: row.fromEmail,
      toEmail: row.toEmail,
      subject: row.subject,
      snippet: row.snippet,
      sentAt: iso(row.sentAt),
      ...(row.brandId ? { brandId: row.brandId } : {}),
    }));
  }

  async listSyncedCalendarEvents(workspaceId: string) {
    const rows = await this.db
      .select()
      .from(schema.crmSyncedCalendarEvent)
      .where(eq(schema.crmSyncedCalendarEvent.workspaceId, workspaceId))
      .orderBy(desc(schema.crmSyncedCalendarEvent.startsAt))
      .limit(50);
    return rows.map((row) => ({
      id: row.id,
      connectionId: row.connectionId,
      title: row.title,
      startsAt: iso(row.startsAt),
      ...(row.endsAt ? { endsAt: iso(row.endsAt) } : {}),
      location: row.location,
      ...(row.brandId ? { brandId: row.brandId } : {}),
      ...(row.jobId ? { jobId: row.jobId } : {}),
    }));
  }

  async getSnapshot(ownerUserId: string): Promise<CrmCollabSnapshot> {
    const workspace = await this.ensureWorkspace(ownerUserId);
    const connections = await this.ensureDefaultConnections(workspace.id);
    const [members, syncedEmails, syncedCalendarEvents] = await Promise.all([
      this.listMembers(workspace.id),
      this.listSyncedEmails(workspace.id),
      this.listSyncedCalendarEvents(workspace.id),
    ]);
    return {
      workspace,
      members: members.filter((member) => member.status !== 'removed'),
      connections,
      syncedEmails,
      syncedCalendarEvents,
    };
  }

  private toWorkspace(
    row: typeof schema.crmWorkspace.$inferSelect,
  ): CrmWorkspaceDto {
    return {
      id: row.id,
      ownerUserId: row.ownerUserId,
      name: row.name,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private toMember(
    row: typeof schema.crmWorkspaceMember.$inferSelect,
  ): CrmWorkspaceMemberDto {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      ...(row.userId ? { userId: row.userId } : {}),
      email: row.email,
      role: row.role as CrmWorkspaceMemberDto['role'],
      status: row.status as CrmWorkspaceMemberDto['status'],
      ...(row.inviteToken ? { inviteToken: row.inviteToken } : {}),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private toConnection(
    row: typeof schema.crmIntegrationConnection.$inferSelect,
  ): CrmIntegrationConnectionDto {
    return {
      id: row.id,
      workspaceId: row.workspaceId,
      provider: row.provider as CrmIntegrationConnectionDto['provider'],
      accountEmail: row.accountEmail,
      status: row.status as CrmIntegrationConnectionDto['status'],
      scopes: Array.isArray(row.scopes) ? row.scopes : [],
      ...(row.lastSyncAt ? { lastSyncAt: iso(row.lastSyncAt) } : {}),
      lastError: row.lastError,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }
}
