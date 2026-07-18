export const INBOX_REPOSITORY = Symbol('INBOX_REPOSITORY');

export type InboxUser = {
  id: string;
  role: string;
  email: string;
  fullName: string;
  companyName: string | null;
};

export type InboxContactRecord = {
  id: string;
  brandId?: string;
  name: string;
  email: string;
  company?: string;
};

export type InboxMessageRecord = {
  id: string;
  contactId: string;
  subject: string;
  content: string;
  createdAt: string;
  read: boolean;
  isFromMe: boolean;
  kind?: 'message' | 'invite';
  campaignId?: string;
};

export type InboxNotificationRecord = {
  id: string;
  type:
    | 'campaign_invite'
    | 'campaign_update'
    | 'application_received'
    | 'application_status'
    | 'platform_invite'
    | 'payment_reminder'
    | 'system';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  href?: string;
  campaignId?: string;
  audience: 'creator' | 'brand' | 'all';
};

export type CreateNotificationInput = {
  userId: string;
  type: InboxNotificationRecord['type'];
  title: string;
  body: string;
  audience: InboxNotificationRecord['audience'];
  href?: string;
  campaignId?: string;
};

export type CreateMessageInput = {
  threadId: string;
  senderUserId: string;
  subject: string;
  content: string;
  kind?: 'message' | 'invite';
  campaignId?: string;
  recipientUserId: string;
};

export interface InboxRepository {
  getUser(userId: string): Promise<InboxUser | null>;
  findUserByEmail(email: string): Promise<InboxUser | null>;
  listThreadsForUser(userId: string): Promise<
    Array<{
      id: string;
      brandUserId: string;
      creatorUserId: string;
    }>
  >;
  getThreadForUser(
    userId: string,
    threadId: string,
  ): Promise<{
    id: string;
    brandUserId: string;
    creatorUserId: string;
  } | null>;
  ensureThread(
    brandUserId: string,
    creatorUserId: string,
  ): Promise<{ id: string; brandUserId: string; creatorUserId: string }>;
  getContactDisplay(
    viewerUserId: string,
    peerUserId: string,
  ): Promise<{ name: string; email: string; company?: string; brandId?: string }>;
  listMessagesForUser(userId: string): Promise<
    Array<{
      id: string;
      threadId: string;
      senderUserId: string;
      subject: string;
      content: string;
      kind: 'message' | 'invite';
      campaignId: string | null;
      createdAt: string;
      read: boolean;
    }>
  >;
  createMessage(input: CreateMessageInput): Promise<{
    id: string;
    threadId: string;
    senderUserId: string;
    subject: string;
    content: string;
    kind: 'message' | 'invite';
    campaignId: string | null;
    createdAt: string;
  }>;
  markThreadRead(userId: string, threadId: string): Promise<void>;
  softDeleteMessage(userId: string, messageId: string): Promise<boolean>;
  listNotifications(userId: string): Promise<InboxNotificationRecord[]>;
  createNotification(
    input: CreateNotificationInput,
  ): Promise<InboxNotificationRecord>;
  markNotificationRead(
    userId: string,
    notificationId: string,
  ): Promise<boolean>;
  markAllNotificationsRead(userId: string): Promise<void>;
}
