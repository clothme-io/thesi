import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  CREATOR_CRM_REPOSITORY,
  type CreatorCrmRepository,
} from './creator-crm.repository';
import { Inject } from '@nestjs/common';
import {
  PostgresCrmCollabRepository,
  type CrmCollabSnapshot,
  type CrmWorkspaceMemberDto,
} from './postgres-crm-collab.repository';

@Injectable()
export class CrmCollabService {
  constructor(
    private readonly collab: PostgresCrmCollabRepository,
    @Inject(CREATOR_CRM_REPOSITORY)
    private readonly crm: CreatorCrmRepository,
  ) {}

  async getSnapshot(userId: string): Promise<CrmCollabSnapshot> {
    await this.requireCreator(userId);
    return this.collab.getSnapshot(userId);
  }

  async renameWorkspace(userId: string, name: string) {
    await this.requireCreator(userId);
    const workspace = await this.collab.ensureWorkspace(userId);
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestException('name is required');
    await this.collab.updateWorkspaceName(workspace.id, trimmed);
    return this.collab.getSnapshot(userId);
  }

  async inviteMember(
    userId: string,
    input: { email: string; role?: CrmWorkspaceMemberDto['role'] },
  ) {
    await this.requireCreator(userId);
    const email = input.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Valid email is required');
    }
    const role = input.role && input.role !== 'owner' ? input.role : 'member';
    const workspace = await this.collab.ensureWorkspace(userId);
    if (email === (await this.collab.getUser(userId))?.email?.toLowerCase()) {
      throw new BadRequestException('You already own this workspace');
    }
    await this.collab.createInvite({
      workspaceId: workspace.id,
      email,
      role,
      invitedByUserId: userId,
    });
    return this.collab.getSnapshot(userId);
  }

  async removeMember(userId: string, memberId: string) {
    await this.requireCreator(userId);
    const workspace = await this.collab.ensureWorkspace(userId);
    const members = await this.collab.listMembers(workspace.id);
    const member = members.find((item) => item.id === memberId);
    if (!member) throw new NotFoundException('Member not found');
    if (member.role === 'owner') {
      throw new BadRequestException('Cannot remove the workspace owner');
    }
    await this.collab.removeMember(workspace.id, memberId);
    return this.collab.getSnapshot(userId);
  }

  async acceptInvite(userId: string, token: string) {
    const user = await this.collab.getUser(userId);
    if (!user) throw new NotFoundException('User account not found');
    if (user.role !== 'creator') {
      throw new ForbiddenException('Creator account required');
    }
    const member = await this.collab.acceptInvite(
      token,
      userId,
      user.email || '',
    );
    if (!member) throw new NotFoundException('Invite not found or expired');
    const workspace = await this.collab.getWorkspace(member.workspaceId);
    return { member, workspace };
  }

  async connectIntegration(
    userId: string,
    connectionId: string,
    accountEmail: string,
  ) {
    await this.requireCreator(userId);
    const email = accountEmail.trim().toLowerCase();
    if (!email.includes('@')) {
      throw new BadRequestException('accountEmail is required');
    }
    const workspace = await this.collab.ensureWorkspace(userId);
    await this.collab.ensureDefaultConnections(workspace.id);
    const connected = await this.collab.connectProvider({
      workspaceId: workspace.id,
      connectionId,
      accountEmail: email,
      userId,
    });
    if (!connected) throw new NotFoundException('Integration not found');
    return this.collab.getSnapshot(userId);
  }

  async disconnectIntegration(userId: string, connectionId: string) {
    await this.requireCreator(userId);
    const workspace = await this.collab.ensureWorkspace(userId);
    const disconnected = await this.collab.disconnectProvider(
      workspace.id,
      connectionId,
    );
    if (!disconnected) throw new NotFoundException('Integration not found');
    return this.collab.getSnapshot(userId);
  }

  async syncIntegration(userId: string, connectionId: string) {
    await this.requireCreator(userId);
    const workspace = await this.collab.ensureWorkspace(userId);
    const connection = await this.collab.getConnection(
      workspace.id,
      connectionId,
    );
    if (!connection) throw new NotFoundException('Integration not found');
    if (connection.status === 'disconnected') {
      throw new BadRequestException('Connect this provider before syncing');
    }

    const run = await this.collab.createSyncRun(connectionId);
    const aggregate = await this.crm.getAggregate(userId);
    const brand = aggregate.brands[0];
    const job = aggregate.jobs[0];
    let emails = 0;
    let events = 0;

    try {
      if (
        connection.provider === 'gmail' ||
        connection.provider === 'microsoft_mail'
      ) {
        const inbound = await this.collab.insertSyncedEmail({
          workspaceId: workspace.id,
          connectionId,
          creatorUserId: userId,
          externalMessageId: `stub-in-${randomUUID()}`,
          direction: 'inbound',
          fromEmail: brand?.email || 'brand@example.com',
          toEmail: connection.accountEmail,
          subject: `Re: ${brand?.name || 'Campaign'} update`,
          snippet:
            'Stub sync: thanks for the latest draft — can we review tomorrow?',
          brandId: brand?.id || null,
        });
        if (inbound) {
          emails += 1;
          const activity = await this.crm.createActivity({
            creatorUserId: userId,
            brandId: brand?.id || null,
            type: 'email_received',
            message: `Email received: ${inbound.subject}`,
          });
          void activity;
        }
        const outbound = await this.collab.insertSyncedEmail({
          workspaceId: workspace.id,
          connectionId,
          creatorUserId: userId,
          externalMessageId: `stub-out-${randomUUID()}`,
          direction: 'outbound',
          fromEmail: connection.accountEmail,
          toEmail: brand?.email || 'brand@example.com',
          subject: `Follow-up: ${brand?.name || 'Brand'} deliverables`,
          snippet: 'Stub sync: sharing the revised cut for feedback.',
          brandId: brand?.id || null,
        });
        if (outbound) {
          emails += 1;
          await this.crm.createActivity({
            creatorUserId: userId,
            brandId: brand?.id || null,
            type: 'email_sent',
            message: `Email sent: ${outbound.subject}`,
          });
        }
      }

      if (
        connection.provider === 'google_calendar' ||
        connection.provider === 'microsoft_calendar'
      ) {
        const startsAt = new Date();
        startsAt.setDate(startsAt.getDate() + 2);
        startsAt.setHours(15, 0, 0, 0);
        const endsAt = new Date(startsAt);
        endsAt.setHours(16, 0, 0, 0);
        const calendarEvent = await this.crm.createCalendarEvent({
          creatorUserId: userId,
          brandId: brand?.id || null,
          jobId: job?.id || null,
          title: `Sync: ${brand?.name || 'Brand'} check-in`,
          type: 'shoot',
          date: startsAt.toISOString().slice(0, 10),
          notes: `Imported from ${connection.provider} (stub sync)`,
        });
        const synced = await this.collab.insertSyncedCalendarEvent({
          workspaceId: workspace.id,
          connectionId,
          creatorUserId: userId,
          externalEventId: `stub-event-${randomUUID()}`,
          title: calendarEvent.title,
          startsAt,
          endsAt,
          location: 'Video call',
          brandId: brand?.id || null,
          jobId: job?.id || null,
          crmCalendarEventId: calendarEvent.id,
        });
        if (synced) {
          events += 1;
          await this.crm.createActivity({
            creatorUserId: userId,
            brandId: brand?.id || null,
            jobId: job?.id || null,
            type: 'meeting_synced',
            message: `Meeting synced: ${synced.title}`,
          });
        }
      }

      await this.collab.markSynced(connectionId, {
        lastSyncAt: new Date(),
        lastError: '',
        status: 'connected',
      });
      await this.collab.finishSyncRun(run.id, {
        status: 'succeeded',
        stats: { emails, events },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Sync failed';
      await this.collab.markSynced(connectionId, {
        lastSyncAt: new Date(),
        lastError: message,
        status: 'error',
      });
      await this.collab.finishSyncRun(run.id, {
        status: 'failed',
        stats: { emails, events },
        error: message,
      });
      throw error;
    }

    return this.collab.getSnapshot(userId);
  }

  private async requireCreator(userId: string) {
    const user = await this.collab.getUser(userId);
    if (!user) throw new NotFoundException('User account not found');
    if (user.role !== 'creator') {
      throw new ForbiddenException('Creator account required');
    }
    return user;
  }
}
