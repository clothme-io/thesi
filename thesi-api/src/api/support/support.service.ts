import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  SUPPORT_REPOSITORY,
  type SupportMessageRecord,
  type SupportRepository,
  type SupportThreadRecord,
  type SupportUser,
} from './support.repository';

@Injectable()
export class SupportService {
  constructor(
    @Inject(SUPPORT_REPOSITORY)
    private readonly support: SupportRepository,
  ) {}

  async list(userId: string): Promise<{
    threads: SupportThreadRecord[];
  }> {
    await this.requireUser(userId);
    return { threads: await this.support.listThreadsForUser(userId) };
  }

  async getThread(
    userId: string,
    threadId: string,
  ): Promise<{
    thread: SupportThreadRecord;
    messages: SupportMessageRecord[];
  }> {
    await this.requireUser(userId);
    const thread = await this.support.getThreadForUser(userId, threadId);
    if (!thread) {
      throw new NotFoundException('Support thread not found');
    }
    const messages = await this.support.listMessagesForThread(
      userId,
      threadId,
    );
    return { thread, messages };
  }

  async createThread(
    userId: string,
    input: { subject: string; content: string },
  ): Promise<{
    thread: SupportThreadRecord;
    message: SupportMessageRecord;
  }> {
    await this.requireUser(userId);
    const subject = input.subject.trim();
    const content = input.content.trim();
    if (!subject) {
      throw new BadRequestException('subject is required');
    }
    if (!content) {
      throw new BadRequestException('content is required');
    }
    return this.support.createThread({ userId, subject, content });
  }

  async sendMessage(
    userId: string,
    input: { threadId: string; content: string },
  ): Promise<SupportMessageRecord> {
    await this.requireUser(userId);
    const content = input.content.trim();
    if (!content) {
      throw new BadRequestException('content is required');
    }
    const thread = await this.support.getThreadForUser(userId, input.threadId);
    if (!thread) {
      throw new NotFoundException('Support thread not found');
    }
    return this.support.createMessage({
      userId,
      threadId: input.threadId,
      content,
    });
  }

  private async requireUser(userId: string): Promise<SupportUser> {
    const user = await this.support.getUser(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    return user;
  }
}
