import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  INBOX_REPOSITORY,
  type CreateNotificationInput,
  type InboxContactRecord,
  type InboxMessageRecord,
  type InboxNotificationRecord,
  type InboxRepository,
  type InboxUser,
} from './inbox.repository';

@Injectable()
export class InboxService {
  constructor(
    @Inject(INBOX_REPOSITORY)
    private readonly inbox: InboxRepository,
  ) {}

  async getInbox(userId: string): Promise<{
    contacts: InboxContactRecord[];
    messages: InboxMessageRecord[];
    notifications: InboxNotificationRecord[];
  }> {
    const user = await this.requireUser(userId);
    const threads = await this.inbox.listThreadsForUser(userId);
    const contacts: InboxContactRecord[] = [];

    for (const thread of threads) {
      const peerId =
        thread.brandUserId === userId
          ? thread.creatorUserId
          : thread.brandUserId;
      const display = await this.inbox.getContactDisplay(userId, peerId);
      contacts.push({
        id: thread.id,
        name: display.name,
        email: display.email,
        ...(display.company ? { company: display.company } : {}),
        ...(display.brandId ? { brandId: display.brandId } : {}),
      });
    }

    const messageRows = await this.inbox.listMessagesForUser(userId);
    const messages: InboxMessageRecord[] = messageRows.map((row) => ({
      id: row.id,
      contactId: row.threadId,
      subject: row.subject,
      content: row.content,
      createdAt: row.createdAt,
      read: row.read,
      isFromMe: row.senderUserId === userId,
      kind: row.kind,
      ...(row.campaignId ? { campaignId: row.campaignId } : {}),
    }));

    const notifications = await this.inbox.listNotifications(userId);
    const filteredNotifications = notifications.filter(
      (notification) =>
        notification.audience === 'all' ||
        notification.audience ===
          (user.role === 'brand' ? 'brand' : 'creator'),
    );

    return { contacts, messages, notifications: filteredNotifications };
  }

  async sendReply(
    userId: string,
    contactId: string,
    subject: string,
    content: string,
  ): Promise<InboxMessageRecord> {
    await this.requireUser(userId);
    const thread = await this.inbox.getThreadForUser(userId, contactId);
    if (!thread) {
      throw new NotFoundException('Conversation not found');
    }
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new BadRequestException('content is required');
    }
    const recipientUserId =
      thread.brandUserId === userId
        ? thread.creatorUserId
        : thread.brandUserId;
    const message = await this.inbox.createMessage({
      threadId: thread.id,
      senderUserId: userId,
      recipientUserId,
      subject: subject.trim() || 'Re: Message',
      content: trimmedContent,
      kind: 'message',
    });
    return {
      id: message.id,
      contactId: message.threadId,
      subject: message.subject,
      content: message.content,
      createdAt: message.createdAt,
      read: true,
      isFromMe: true,
      kind: message.kind,
      ...(message.campaignId ? { campaignId: message.campaignId } : {}),
    };
  }

  async markContactRead(userId: string, contactId: string): Promise<void> {
    await this.requireUser(userId);
    const thread = await this.inbox.getThreadForUser(userId, contactId);
    if (!thread) {
      throw new NotFoundException('Conversation not found');
    }
    await this.inbox.markThreadRead(userId, contactId);
  }

  async deleteMessage(userId: string, messageId: string): Promise<void> {
    await this.requireUser(userId);
    const deleted = await this.inbox.softDeleteMessage(userId, messageId);
    if (!deleted) {
      throw new NotFoundException('Message not found');
    }
  }

  async markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<void> {
    await this.requireUser(userId);
    const ok = await this.inbox.markNotificationRead(userId, notificationId);
    if (!ok) {
      throw new NotFoundException('Notification not found');
    }
  }

  async markAllNotificationsRead(userId: string): Promise<void> {
    await this.requireUser(userId);
    await this.inbox.markAllNotificationsRead(userId);
  }

  async createNotificationForUser(
    input: CreateNotificationInput,
  ): Promise<InboxNotificationRecord> {
    return this.inbox.createNotification(input);
  }

  async notifySelf(
    userId: string,
    input: Omit<CreateNotificationInput, 'userId'>,
  ): Promise<InboxNotificationRecord> {
    await this.requireUser(userId);
    return this.inbox.createNotification({ ...input, userId });
  }

  async deliverCampaignInvite(
    brandUserId: string,
    input: {
      creatorUserId?: string;
      creatorEmail: string;
      creatorName: string;
      campaignId: string;
      campaignName: string;
      brandName: string;
      external: boolean;
    },
  ): Promise<{ delivered: boolean }> {
    const brand = await this.requireUser(brandUserId);
    if (brand.role !== 'brand') {
      throw new ForbiddenException('Brand account required');
    }

    if (input.external) {
      return { delivered: false };
    }

    let creator =
      (input.creatorUserId
        ? await this.inbox.getUser(input.creatorUserId)
        : null) ?? (await this.inbox.findUserByEmail(input.creatorEmail));

    if (!creator || creator.role !== 'creator') {
      throw new NotFoundException('Creator account not found for invite delivery');
    }

    const thread = await this.inbox.ensureThread(brandUserId, creator.id);
    await this.inbox.createMessage({
      threadId: thread.id,
      senderUserId: brandUserId,
      recipientUserId: creator.id,
      subject: `Campaign invite: ${input.campaignName}`,
      content: `${input.brandName} invited you to collaborate on "${input.campaignName}". Open this thread to reply or ask questions about the campaign brief.`,
      kind: 'invite',
      campaignId: input.campaignId,
    });

    await this.inbox.createNotification({
      userId: creator.id,
      type: 'campaign_invite',
      title: `Campaign invite: ${input.campaignName}`,
      body: `${input.brandName} invited you to collaborate on "${input.campaignName}". Check Messages to reply.`,
      href: '/app/inbox',
      campaignId: input.campaignId,
      audience: 'creator',
    });

    return { delivered: true };
  }

  private async requireUser(userId: string): Promise<InboxUser> {
    const user = await this.inbox.getUser(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    return user;
  }
}
