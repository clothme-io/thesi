import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  SupportMessageRecord,
  SupportRepository,
  SupportThreadRecord,
  SupportUser,
} from './support.repository';
import { SupportService } from './support.service';

class FakeSupportRepository implements SupportRepository {
  users = new Map<string, SupportUser>();
  threads: SupportThreadRecord[] = [];
  messages: SupportMessageRecord[] = [];
  inboxThreadsCreated = 0;

  async getUser(userId: string) {
    return this.users.get(userId) ?? null;
  }

  async listThreadsForUser(userId: string) {
    return this.threads.filter((thread) => thread.userId === userId);
  }

  async getThreadForUser(userId: string, threadId: string) {
    return (
      this.threads.find(
        (thread) => thread.userId === userId && thread.id === threadId,
      ) ?? null
    );
  }

  async listMessagesForThread(userId: string, threadId: string) {
    const thread = await this.getThreadForUser(userId, threadId);
    if (!thread) return [];
    return this.messages.filter((message) => message.threadId === threadId);
  }

  async createThread(input: {
    userId: string;
    subject: string;
    content: string;
  }) {
    const now = new Date().toISOString();
    const thread: SupportThreadRecord = {
      id: `support-thread-${this.threads.length + 1}`,
      userId: input.userId,
      subject: input.subject,
      status: 'open',
      createdAt: now,
      updatedAt: now,
      lastMessage: input.content,
      unreadCount: 0,
    };
    const message: SupportMessageRecord = {
      id: `support-message-${this.messages.length + 1}`,
      threadId: thread.id,
      senderUserId: input.userId,
      senderType: 'user',
      content: input.content,
      createdAt: now,
    };
    this.threads.push(thread);
    this.messages.push(message);
    return { thread, message };
  }

  async createMessage(input: {
    userId: string;
    threadId: string;
    content: string;
  }) {
    const message: SupportMessageRecord = {
      id: `support-message-${this.messages.length + 1}`,
      threadId: input.threadId,
      senderUserId: input.userId,
      senderType: 'user',
      content: input.content,
      createdAt: new Date().toISOString(),
    };
    this.messages.push(message);
    return message;
  }
}

describe('SupportService', () => {
  let repository: FakeSupportRepository;
  let service: SupportService;

  beforeEach(() => {
    repository = new FakeSupportRepository();
    repository.users.set('user-1', { id: 'user-1', role: 'creator' });
    service = new SupportService(repository);
  });

  it('creates support threads outside of inbox state', async () => {
    const result = await service.createThread('user-1', {
      subject: 'Billing question',
      content: 'Can you help with my invoice?',
    });

    expect(result.thread).toEqual(
      expect.objectContaining({
        userId: 'user-1',
        subject: 'Billing question',
        lastMessage: 'Can you help with my invoice?',
      }),
    );
    expect(result.message).toEqual(
      expect.objectContaining({
        threadId: result.thread.id,
        senderType: 'user',
      }),
    );
    expect(repository.inboxThreadsCreated).toBe(0);
  });

  it('lists only the authenticated user support threads', async () => {
    repository.users.set('user-2', { id: 'user-2', role: 'brand' });
    await service.createThread('user-1', {
      subject: 'Mine',
      content: 'Message',
    });
    await service.createThread('user-2', {
      subject: 'Other',
      content: 'Message',
    });

    await expect(service.list('user-1')).resolves.toEqual({
      threads: [expect.objectContaining({ subject: 'Mine' })],
    });
  });

  it('adds messages only to an owned support thread', async () => {
    const created = await service.createThread('user-1', {
      subject: 'Need help',
      content: 'First message',
    });

    const reply = await service.sendMessage('user-1', {
      threadId: created.thread.id,
      content: 'Second message',
    });

    expect(reply).toEqual(
      expect.objectContaining({
        threadId: created.thread.id,
        content: 'Second message',
      }),
    );
    await expect(
      service.getThread('user-1', created.thread.id),
    ).resolves.toEqual({
      thread: expect.objectContaining({ id: created.thread.id }),
      messages: [
        expect.objectContaining({ content: 'First message' }),
        expect.objectContaining({ content: 'Second message' }),
      ],
    });
  });

  it('rejects blank support content', async () => {
    await expect(
      service.createThread('user-1', { subject: ' ', content: 'Help' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createThread('user-1', { subject: 'Help', content: ' ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects unknown users and inaccessible threads', async () => {
    await expect(service.list('missing-user')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(
      service.sendMessage('user-1', {
        threadId: 'support-thread-missing',
        content: 'Hello',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
