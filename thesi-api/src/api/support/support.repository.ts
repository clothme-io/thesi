export const SUPPORT_REPOSITORY = Symbol('SUPPORT_REPOSITORY');

export type SupportUser = {
  id: string;
  role: string;
};

export type SupportThreadStatus = 'open' | 'pending' | 'closed';

export type SupportThreadRecord = {
  id: string;
  userId: string;
  subject: string;
  status: SupportThreadStatus;
  createdAt: string;
  updatedAt: string;
  lastMessage?: string;
  unreadCount: number;
};

export type SupportMessageRecord = {
  id: string;
  threadId: string;
  senderUserId?: string | null;
  senderType: 'user' | 'support';
  content: string;
  createdAt: string;
};

export interface SupportRepository {
  getUser(userId: string): Promise<SupportUser | null>;
  listThreadsForUser(userId: string): Promise<SupportThreadRecord[]>;
  getThreadForUser(
    userId: string,
    threadId: string,
  ): Promise<SupportThreadRecord | null>;
  listMessagesForThread(
    userId: string,
    threadId: string,
  ): Promise<SupportMessageRecord[]>;
  createThread(input: {
    userId: string;
    subject: string;
    content: string;
  }): Promise<{
    thread: SupportThreadRecord;
    message: SupportMessageRecord;
  }>;
  createMessage(input: {
    userId: string;
    threadId: string;
    content: string;
  }): Promise<SupportMessageRecord>;
}
