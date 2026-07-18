import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateMessageInput,
  CreateNotificationInput,
  InboxNotificationRecord,
  InboxRepository,
  InboxUser,
} from './inbox.repository';
import { InboxService } from './inbox.service';

class FakeInboxRepository implements InboxRepository {
  user: InboxUser | null = null;
  users = new Map<string, InboxUser>();
  threads: Array<{
    id: string;
    brandUserId: string;
    creatorUserId: string;
  }> = [];
  messages: Array<{
    id: string;
    threadId: string;
    senderUserId: string;
    subject: string;
    content: string;
    kind: 'message' | 'invite';
    campaignId: string | null;
    createdAt: string;
    states: Map<string, { read: boolean; deleted: boolean }>;
  }> = [];
  notifications: Array<InboxNotificationRecord & { userId: string }> = [];

  async getUser(userId: string) {
    return this.users.get(userId) ?? (this.user?.id === userId ? this.user : null);
  }

  async findUserByEmail(email: string) {
    return (
      [...this.users.values()].find(
        (user) => user.email.toLowerCase() === email.toLowerCase(),
      ) ?? null
    );
  }

  async listThreadsForUser(userId: string) {
    return this.threads.filter(
      (thread) =>
        thread.brandUserId === userId || thread.creatorUserId === userId,
    );
  }

  async getThreadForUser(userId: string, threadId: string) {
    return (
      this.threads.find(
        (thread) =>
          thread.id === threadId &&
          (thread.brandUserId === userId || thread.creatorUserId === userId),
      ) ?? null
    );
  }

  async ensureThread(brandUserId: string, creatorUserId: string) {
    const existing = this.threads.find(
      (thread) =>
        thread.brandUserId === brandUserId &&
        thread.creatorUserId === creatorUserId,
    );
    if (existing) return existing;
    const created = {
      id: `thread-${this.threads.length + 1}`,
      brandUserId,
      creatorUserId,
    };
    this.threads.push(created);
    return created;
  }

  async getContactDisplay(_viewerUserId: string, peerUserId: string) {
    const peer = await this.getUser(peerUserId);
    return {
      name: peer?.fullName ?? 'Unknown',
      email: peer?.email ?? '',
      company: peer?.companyName ?? undefined,
      brandId: peer?.role === 'brand' ? peer.id : undefined,
    };
  }

  async listMessagesForUser(userId: string) {
    return this.messages
      .filter((message) => {
        const state = message.states.get(userId);
        return state && !state.deleted;
      })
      .map((message) => ({
        id: message.id,
        threadId: message.threadId,
        senderUserId: message.senderUserId,
        subject: message.subject,
        content: message.content,
        kind: message.kind,
        campaignId: message.campaignId,
        createdAt: message.createdAt,
        read: message.states.get(userId)?.read ?? false,
      }));
  }

  async createMessage(input: CreateMessageInput) {
    const message = {
      id: `msg-${this.messages.length + 1}`,
      threadId: input.threadId,
      senderUserId: input.senderUserId,
      subject: input.subject,
      content: input.content,
      kind: input.kind ?? ('message' as const),
      campaignId: input.campaignId ?? null,
      createdAt: new Date().toISOString(),
      states: new Map([
        [input.senderUserId, { read: true, deleted: false }],
        [input.recipientUserId, { read: false, deleted: false }],
      ]),
    };
    this.messages.push(message);
    return {
      id: message.id,
      threadId: message.threadId,
      senderUserId: message.senderUserId,
      subject: message.subject,
      content: message.content,
      kind: message.kind,
      campaignId: message.campaignId,
      createdAt: message.createdAt,
    };
  }

  async markThreadRead(userId: string, threadId: string) {
    for (const message of this.messages) {
      if (message.threadId !== threadId) continue;
      if (message.senderUserId === userId) continue;
      const state = message.states.get(userId);
      if (state) state.read = true;
    }
  }

  async softDeleteMessage(userId: string, messageId: string) {
    const message = this.messages.find((item) => item.id === messageId);
    const state = message?.states.get(userId);
    if (!state) return false;
    state.deleted = true;
    return true;
  }

  async listNotifications(userId: string) {
    return this.notifications.filter((item) => item.userId === userId);
  }

  async createNotification(input: CreateNotificationInput) {
    const notification: InboxNotificationRecord & { userId: string } = {
      id: `notif-${this.notifications.length + 1}`,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      createdAt: new Date().toISOString(),
      read: false,
      audience: input.audience,
      ...(input.href ? { href: input.href } : {}),
      ...(input.campaignId ? { campaignId: input.campaignId } : {}),
    };
    this.notifications.push(notification);
    return notification;
  }

  async markNotificationRead(userId: string, notificationId: string) {
    const notification = this.notifications.find(
      (item) => item.id === notificationId && item.userId === userId,
    );
    if (!notification) return false;
    notification.read = true;
    return true;
  }

  async markAllNotificationsRead(userId: string) {
    for (const notification of this.notifications) {
      if (notification.userId === userId) notification.read = true;
    }
  }
}

describe('InboxService', () => {
  let repository: FakeInboxRepository;
  let service: InboxService;

  beforeEach(() => {
    repository = new FakeInboxRepository();
    service = new InboxService(repository);
    repository.users.set('brand-1', {
      id: 'brand-1',
      role: 'brand',
      email: 'brand@thesi.dev',
      fullName: 'Brand One',
      companyName: 'Acme',
    });
    repository.users.set('creator-1', {
      id: 'creator-1',
      role: 'creator',
      email: 'creator@thesi.dev',
      fullName: 'Creator One',
      companyName: null,
    });
  });

  it('delivers an internal campaign invite into the creator inbox', async () => {
    await expect(
      service.deliverCampaignInvite('brand-1', {
        creatorUserId: 'creator-1',
        creatorEmail: 'creator@thesi.dev',
        creatorName: 'Creator One',
        campaignId: 'campaign-1',
        campaignName: 'Summer UGC',
        brandName: 'Acme',
        external: false,
      }),
    ).resolves.toEqual({ delivered: true });

    repository.user = repository.users.get('creator-1')!;
    const inbox = await service.getInbox('creator-1');
    expect(inbox.contacts).toHaveLength(1);
    expect(inbox.messages[0]).toEqual(
      expect.objectContaining({
        kind: 'invite',
        isFromMe: false,
        subject: 'Campaign invite: Summer UGC',
      }),
    );
    expect(inbox.notifications[0]).toEqual(
      expect.objectContaining({ type: 'campaign_invite' }),
    );
  });

  it('rejects empty replies', async () => {
    repository.user = repository.users.get('brand-1')!;
    repository.threads.push({
      id: 'thread-1',
      brandUserId: 'brand-1',
      creatorUserId: 'creator-1',
    });

    await expect(
      service.sendReply('brand-1', 'thread-1', 'Hello', '   '),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents creators from delivering campaign invites', async () => {
    await expect(
      service.deliverCampaignInvite('creator-1', {
        creatorEmail: 'other@thesi.dev',
        creatorName: 'Other',
        campaignId: 'campaign-1',
        campaignName: 'Summer',
        brandName: 'Acme',
        external: false,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found for unknown conversations', async () => {
    repository.user = repository.users.get('brand-1')!;
    await expect(
      service.markContactRead('brand-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
