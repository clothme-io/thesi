import {
  ForbiddenException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { JwtService } from '@nestjs/jwt';
import type {
  CampaignContentRow,
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
  posts: Array<SyncedUgcPost & { id: string }> = [];
  campaignContent: CampaignContentRow[] = [];
  acceptedCampaigns = new Set<string>();
  ownedCampaigns = new Set<string>();

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
    source: SocialProvider,
    posts: SyncedUgcPost[],
  ) {
    this.posts = this.posts.filter((post) => post.source !== source);
    this.posts.push(
      ...posts.map((post, index) => ({
        ...post,
        id: post.id || `${source}-${index}`,
      })),
    );
  }

  async listSyncedPosts() {
    return this.posts;
  }

  async upsertSyncedPost(_creatorUserId: string, post: SyncedUgcPost) {
    const existing = this.posts.find(
      (row) =>
        row.source === post.source &&
        row.externalMediaId &&
        row.externalMediaId === post.externalMediaId,
    );
    const saved = {
      ...post,
      id: existing?.id || post.id || `${post.source}-${this.posts.length + 1}`,
    };
    this.posts = this.posts.filter((row) => row.id !== saved.id);
    this.posts.push(saved);
    return saved;
  }

  async getSyncedPost(_creatorUserId: string, postId: string) {
    return this.posts.find((post) => post.id === postId) ?? null;
  }

  async creatorAcceptedCampaign(_creatorUserId: string, campaignId: string) {
    return this.acceptedCampaigns.has(campaignId);
  }

  async brandOwnsCampaign(_ownerUserId: string, campaignId: string) {
    return this.ownedCampaigns.has(campaignId);
  }

  async listCampaignContent(campaignId: string) {
    return this.campaignContent.filter((row) => row.campaignId === campaignId);
  }

  async listCampaignContentForSync() {
    return this.campaignContent;
  }

  async upsertCampaignContent(
    row: Omit<CampaignContentRow, 'id' | 'lastSyncedAt' | 'lastError'> & {
      lastSyncedAt?: Date | null;
      lastError?: string | null;
    },
  ) {
    const existing = this.campaignContent.find(
      (item) =>
        item.campaignId === row.campaignId &&
        item.creatorUserId === row.creatorUserId &&
        item.provider === row.provider &&
        item.externalMediaId === row.externalMediaId,
    );
    const saved: CampaignContentRow = {
      id: existing?.id || `content-${this.campaignContent.length + 1}`,
      campaignId: row.campaignId,
      creatorUserId: row.creatorUserId,
      provider: row.provider,
      externalMediaId: row.externalMediaId,
      url: row.url,
      title: row.title,
      views: row.views,
      likes: row.likes,
      comments: row.comments,
      lastSyncedAt:
        row.lastSyncedAt === undefined ? new Date() : row.lastSyncedAt,
      lastError: row.lastError ?? null,
    };
    this.campaignContent = this.campaignContent.filter(
      (item) => item.id !== saved.id,
    );
    this.campaignContent.push(saved);
    return saved;
  }

  async getCampaignContent(campaignId: string, contentId: string) {
    return (
      this.campaignContent.find(
        (row) => row.campaignId === campaignId && row.id === contentId,
      ) ?? null
    );
  }

  async deleteCampaignContent(
    campaignId: string,
    contentId: string,
    creatorUserId?: string,
  ) {
    const before = this.campaignContent.length;
    this.campaignContent = this.campaignContent.filter((row) => {
      if (row.campaignId !== campaignId || row.id !== contentId) return true;
      if (creatorUserId && row.creatorUserId !== creatorUserId) return true;
      return false;
    });
    return this.campaignContent.length < before;
  }
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

  it('marks YouTube as needs_setup when Google OAuth is missing', async () => {
    const listed = await service.listAccounts('creator-1');
    expect(listed.youtubeConfigured).toBe(false);
    expect(listed.accounts.find((row) => row.provider === 'youtube')?.status).toBe(
      'needs_setup',
    );
  });

  it('returns 503 when YouTube sync is called without Google OAuth', async () => {
    await expect(service.syncYouTube('creator-1')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(service.syncYouTube('creator-1')).rejects.toThrow(
      /GOOGLE_CLIENT/,
    );
  });

  it('returns a Google OAuth URL with youtube.readonly when configured', async () => {
    env.GOOGLE_CLIENT_ID = 'google-client';
    env.GOOGLE_CLIENT_SECRET = 'google-secret';
    const { url } = await service.youtubeConnectUrl('creator-1');
    expect(url).toContain('accounts.google.com');
    expect(url).toContain(encodeURIComponent('youtube.readonly'));
    expect(url).not.toContain('youtube.upload');
    expect(url).not.toContain('youtube.force-ssl');
  });

  it('returns 503 when looking up content without a connected account', async () => {
    await expect(
      service.lookupContent(
        'creator-1',
        'https://www.youtube.com/watch?v=abcdefghijk',
      ),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('blocks attaching campaign content before the creator accepted', async () => {
    await expect(
      service.attachCampaignContent(
        'creator-1',
        'creator',
        'camp-1',
        'https://www.youtube.com/watch?v=abcdefghijk',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
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
