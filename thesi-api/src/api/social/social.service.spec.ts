import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type {
  CreatorSocialContext,
  SocialConnectionRow,
  SocialProvider,
  SocialRepository,
  SyncedUgcPost,
} from './social.repository';
import { SocialService } from './social.service';

class FakeSocialRepository implements SocialRepository {
  context: CreatorSocialContext | null = {
    userId: 'creator-1',
    role: 'creator',
    youtube: 'https://youtube.com/@ava',
    tiktok: '',
    instagram: '',
    platforms: [],
    avgViews: 0,
    avgEngagementRate: 0,
  };
  connections: SocialConnectionRow[] = [];

  async getCreatorContext() {
    return this.context;
  }

  async listConnections() {
    return this.connections;
  }

  async getConnection(creatorUserId: string, provider: SocialProvider) {
    return (
      this.connections.find(
        (row) =>
          row.creatorUserId === creatorUserId && row.provider === provider,
      ) ?? null
    );
  }

  async listConnectedForSync() {
    return this.connections.filter((row) => row.status === 'connected');
  }

  async upsertConnection(
    creatorUserId: string,
    provider: SocialProvider,
    patch: Partial<SocialConnectionRow>,
  ) {
    const existing = await this.getConnection(creatorUserId, provider);
    const row: SocialConnectionRow = {
      id: existing?.id ?? `${provider}-1`,
      creatorUserId,
      provider,
      status: 'disconnected',
      externalAccountId: '',
      handle: '',
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      scopes: [],
      lastSyncAt: null,
      lastError: null,
      ...existing,
      ...patch,
    };
    this.connections = this.connections.filter(
      (item) => !(item.creatorUserId === creatorUserId && item.provider === provider),
    );
    this.connections.push(row);
    return row;
  }

  async applyDirectoryStats() {}

  async replaceSyncedPosts(
    _creatorUserId: string,
    _source: SocialProvider,
    _posts: SyncedUgcPost[],
  ) {}
}

describe('SocialService', () => {
  let repository: FakeSocialRepository;
  let env: Record<string, string | undefined>;
  let service: SocialService;

  beforeEach(() => {
    repository = new FakeSocialRepository();
    env = {
      JWT_SECRET: 'jwt-secret',
      THESI_WEB_URL: 'http://localhost:3010',
    };
    const config = {
      get: jest.fn((key: string) => env[key]),
      getOrThrow: jest.fn((key: string) => {
        const value = env[key];
        if (!value) throw new Error(`Missing ${key}`);
        return value;
      }),
    } as unknown as ConfigService;
    const jwt = {
      signAsync: jest.fn().mockResolvedValue('signed-state'),
      verifyAsync: jest.fn(),
    } as unknown as JwtService;
    service = new SocialService(repository, config, jwt);
  });

  it('marks YouTube as needs_setup when YOUTUBE_API_KEY is missing', async () => {
    const listed = await service.listAccounts('creator-1');
    expect(listed.youtubeConfigured).toBe(false);
    expect(listed.accounts.find((row) => row.provider === 'youtube')?.status).toBe(
      'needs_setup',
    );
  });

  it('returns 503 when YouTube sync is called without an API key', async () => {
    await expect(service.syncYouTube('creator-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.syncYouTube('creator-1')).rejects.toThrow(
      /YOUTUBE_API_KEY/,
    );
  });

  it('returns 503 when TikTok connect is called without app credentials', async () => {
    await expect(service.tiktokConnectUrl('creator-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('blocks brands from social account routes', async () => {
    repository.context = {
      ...repository.context!,
      role: 'brand',
    };
    await expect(service.listAccounts('brand-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
