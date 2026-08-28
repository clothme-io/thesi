import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  fetchInstagramRecentMedia,
  fetchInstagramUserStats,
  instagramAuthorizeUrl,
} from './instagram.client';
import {
  parseInstagramHandle,
  parseTikTokHandle,
  parseYouTubeChannelRef,
} from './parse-social-handle';
import {
  connectedAvgViews,
  upsertConnectedPlatform,
} from './social-stats.util';
import {
  SOCIAL_REPOSITORY,
  type SocialProvider,
  type SocialRepository,
} from './social.repository';
import { decryptSecret, encryptSecret } from './token-crypto';
import {
  exchangeTikTokCode,
  fetchTikTokRecentVideos,
  fetchTikTokUserStats,
  refreshTikTokToken,
  tiktokAuthorizeUrl,
} from './tiktok.client';
import {
  fetchYouTubeChannelStats,
  fetchYouTubeRecentVideos,
} from './youtube.client';

export type SocialAccountStatus = {
  provider: SocialProvider;
  status: 'disconnected' | 'connected' | 'error' | 'needs_setup';
  configured: boolean;
  handle: string;
  lastSyncAt: string | null;
  lastError: string | null;
};

type OauthState = {
  sub: string;
  provider: 'tiktok' | 'instagram';
  purpose: 'social-oauth';
};

@Injectable()
export class SocialService {
  constructor(
    @Inject(SOCIAL_REPOSITORY)
    private readonly social: SocialRepository,
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
  ) {}

  async listAccounts(userId: string): Promise<{
    accounts: SocialAccountStatus[];
    youtubeConfigured: boolean;
  }> {
    await this.requireCreator(userId);
    const connections = await this.social.listConnections(userId);
    const byProvider = new Map(connections.map((row) => [row.provider, row]));
    return {
      youtubeConfigured: Boolean(this.youtubeApiKey()),
      accounts: (['youtube', 'tiktok', 'instagram'] as const).map((provider) => {
        const row = byProvider.get(provider);
        return {
          provider,
          status: this.providerConfigured(provider)
            ? ((row?.status as SocialAccountStatus['status']) ?? 'disconnected')
            : 'needs_setup',
          configured: this.providerConfigured(provider),
          handle: row?.handle ?? '',
          lastSyncAt: row?.lastSyncAt?.toISOString() ?? null,
          lastError: row?.lastError ?? null,
        };
      }),
    };
  }

  async syncYouTube(userId: string): Promise<{ accounts: SocialAccountStatus[] }> {
    const context = await this.requireCreator(userId);
    const apiKey = this.youtubeApiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'YouTube sync is not configured. Add YOUTUBE_API_KEY, then try again.',
      );
    }
    const ref = parseYouTubeChannelRef(context.youtube);
    if (!ref) {
      throw new BadRequestException(
        'Add a YouTube channel URL or @handle on your Profile first.',
      );
    }
    try {
      const channel = await fetchYouTubeChannelStats(apiKey, ref);
      let avgViews = 0;
      try {
        const videos = channel.uploadsPlaylistId
          ? await fetchYouTubeRecentVideos(apiKey, channel.uploadsPlaylistId)
          : [];
        if (videos.length > 0) {
          avgViews = Math.round(
            videos.reduce((sum, video) => sum + video.views, 0) / videos.length,
          );
          await this.social.replaceSyncedPosts(
            userId,
            'youtube',
            videos.map((video) => ({
              ...video,
              platform: 'YouTube',
              shares: 0,
              source: 'youtube' as const,
            })),
          );
        }
      } catch {
        // Recent-video lookup is best-effort; follower sync still wins.
      }
      const platforms = upsertConnectedPlatform(context.platforms, {
        platform: 'YouTube',
        followers: channel.subscriberCount,
        avgViews,
        engagementRate: 0,
        source: 'youtube',
      });
      await this.social.applyDirectoryStats(
        userId,
        platforms,
        connectedAvgViews(platforms) || context.avgViews,
        context.avgEngagementRate,
      );
      await this.social.upsertConnection(userId, 'youtube', {
        status: 'connected',
        externalAccountId: channel.channelId,
        handle: channel.handle,
        lastSyncAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof BadRequestException
      ) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'YouTube sync failed';
      await this.social.upsertConnection(userId, 'youtube', {
        status: 'error',
        lastError: message,
      });
      throw new ServiceUnavailableException(message);
    }
    return this.listAccounts(userId);
  }

  async tiktokConnectUrl(userId: string): Promise<{ url: string }> {
    await this.requireCreator(userId);
    const clientKey = this.config.get<string>('TIKTOK_CLIENT_KEY')?.trim();
    const redirectUri = this.tiktokRedirectUri();
    if (!clientKey || !this.config.get<string>('TIKTOK_CLIENT_SECRET')?.trim()) {
      throw new ServiceUnavailableException(
        'TikTok is not configured. Add TIKTOK_CLIENT_KEY, TIKTOK_CLIENT_SECRET, and TIKTOK_REDIRECT_URI.',
      );
    }
    const state = await this.signOauthState(userId, 'tiktok');
    return { url: tiktokAuthorizeUrl({ clientKey, redirectUri, state }) };
  }

  async instagramConnectUrl(userId: string): Promise<{ url: string }> {
    await this.requireCreator(userId);
    const appId = this.config.get<string>('INSTAGRAM_APP_ID')?.trim();
    const redirectUri = this.instagramRedirectUri();
    if (!appId || !this.config.get<string>('INSTAGRAM_APP_SECRET')?.trim()) {
      throw new ServiceUnavailableException(
        'Instagram is not configured. Add INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET, and INSTAGRAM_REDIRECT_URI.',
      );
    }
    const state = await this.signOauthState(userId, 'instagram');
    return { url: instagramAuthorizeUrl({ appId, redirectUri, state }) };
  }

  async handleOauthCallback(
    provider: 'tiktok' | 'instagram',
    code: string | undefined,
    state: string | undefined,
    errorFromProvider?: string,
  ): Promise<string> {
    const web = this.webSettingsUrl();
    if (errorFromProvider || !code || !state) {
      return `${web}?error=${encodeURIComponent(errorFromProvider || 'missing_code')}`;
    }
    let userId: string;
    try {
      const payload = await this.jwt.verifyAsync<OauthState>(state);
      if (payload.purpose !== 'social-oauth' || payload.provider !== provider) {
        throw new Error('Invalid OAuth state');
      }
      userId = payload.sub;
    } catch {
      return `${web}?error=invalid_state`;
    }
    try {
      if (provider === 'tiktok') {
        await this.finishTikTok(userId, code);
      } else {
        await this.finishInstagram(userId, code);
      }
      await this.syncProvider(userId, provider);
      return `${web}?connected=${provider}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OAuth failed';
      await this.social.upsertConnection(userId, provider, {
        status: 'error',
        lastError: message,
      });
      return `${web}?error=${encodeURIComponent(message)}`;
    }
  }

  async syncProvider(
    userId: string,
    provider: SocialProvider,
  ): Promise<{ accounts: SocialAccountStatus[] }> {
    if (provider === 'youtube') return this.syncYouTube(userId);
    if (provider === 'tiktok') await this.syncTikTok(userId);
    else await this.syncInstagram(userId);
    return this.listAccounts(userId);
  }

  async disconnect(
    userId: string,
    provider: SocialProvider,
  ): Promise<{ accounts: SocialAccountStatus[] }> {
    const context = await this.requireCreator(userId);
    await this.social.upsertConnection(userId, provider, {
      status: 'disconnected',
      accessTokenEncrypted: null,
      refreshTokenEncrypted: null,
      tokenExpiresAt: null,
      lastError: null,
    });
    await this.social.replaceSyncedPosts(userId, provider, []);
    const platforms = context.platforms.filter((row) => row.source !== provider);
    await this.social.applyDirectoryStats(
      userId,
      platforms,
      connectedAvgViews(platforms) || context.avgViews,
      context.avgEngagementRate,
    );
    return this.listAccounts(userId);
  }

  async syncAllForUser(userId: string): Promise<{ accounts: SocialAccountStatus[] }> {
    const listed = await this.listAccounts(userId);
    for (const account of listed.accounts) {
      if (account.provider === 'youtube' && account.configured) {
        try {
          await this.syncYouTube(userId);
        } catch {
          // lastError is already stored when the lookup failed mid-sync
        }
        continue;
      }
      if (account.status === 'connected') {
        try {
          await this.syncProvider(userId, account.provider);
        } catch {
          // lastError is already stored
        }
      }
    }
    return this.listAccounts(userId);
  }

  async cronSyncAll(): Promise<{ synced: number }> {
    const rows = await this.social.listConnectedForSync();
    let synced = 0;
    for (const row of rows) {
      try {
        await this.syncProvider(row.creatorUserId, row.provider);
        synced += 1;
      } catch {
        // lastError stored per account
      }
    }
    return { synced };
  }

  private async finishTikTok(userId: string, code: string): Promise<void> {
    const clientKey = this.config.get<string>('TIKTOK_CLIENT_KEY')?.trim();
    const clientSecret = this.config.get<string>('TIKTOK_CLIENT_SECRET')?.trim();
    const redirectUri = this.tiktokRedirectUri();
    if (!clientKey || !clientSecret) {
      throw new Error('TikTok is not configured');
    }
    const token = await exchangeTikTokCode({
      clientKey,
      clientSecret,
      code,
      redirectUri,
    });
    await this.social.upsertConnection(userId, 'tiktok', {
      status: 'connected',
      accessTokenEncrypted: this.encrypt(token.accessToken),
      refreshTokenEncrypted: token.refreshToken
        ? this.encrypt(token.refreshToken)
        : null,
      tokenExpiresAt: token.expiresIn
        ? new Date(Date.now() + token.expiresIn * 1000)
        : null,
      externalAccountId: token.openId ?? '',
      scopes: token.scope ? token.scope.split(/[,\s]+/).filter(Boolean) : [],
      lastError: null,
    });
  }

  private async finishInstagram(userId: string, code: string): Promise<void> {
    const appId = this.config.get<string>('INSTAGRAM_APP_ID')?.trim();
    const appSecret = this.config.get<string>('INSTAGRAM_APP_SECRET')?.trim();
    const redirectUri = this.instagramRedirectUri();
    if (!appId || !appSecret) {
      throw new Error('Instagram is not configured');
    }
    const shortLived = await exchangeInstagramCode({
      appId,
      appSecret,
      code,
      redirectUri,
    });
    let accessToken = shortLived.accessToken;
    let expiresIn: number | undefined;
    try {
      const longLived = await exchangeInstagramLongLivedToken({
        appSecret,
        accessToken,
      });
      accessToken = longLived.accessToken;
      expiresIn = longLived.expiresIn;
    } catch {
      // Short-lived token still lets the immediate sync run.
    }
    await this.social.upsertConnection(userId, 'instagram', {
      status: 'connected',
      accessTokenEncrypted: this.encrypt(accessToken),
      tokenExpiresAt: expiresIn
        ? new Date(Date.now() + expiresIn * 1000)
        : null,
      externalAccountId: shortLived.userId ?? '',
      lastError: null,
    });
  }

  private async syncTikTok(userId: string): Promise<void> {
    const context = await this.requireCreator(userId);
    const access = await this.tiktokAccessToken(userId);
    if (!access) {
      throw new ServiceUnavailableException('Connect TikTok first.');
    }
    try {
      const user = await fetchTikTokUserStats(access);
      let videos: Awaited<ReturnType<typeof fetchTikTokRecentVideos>> = [];
      try {
        videos = await fetchTikTokRecentVideos(access);
      } catch {
        // Video list is best-effort.
      }
      if (videos.length > 0) {
        await this.social.replaceSyncedPosts(
          userId,
          'tiktok',
          videos.map((video) => ({
            ...video,
            platform: 'TikTok',
            source: 'tiktok' as const,
          })),
        );
      }
      const avgViews =
        videos.length > 0
          ? Math.round(
              videos.reduce((sum, video) => sum + video.views, 0) / videos.length,
            )
          : 0;
      const platforms = upsertConnectedPlatform(context.platforms, {
        platform: 'TikTok',
        followers: user.followerCount,
        avgViews,
        engagementRate: 0,
        source: 'tiktok',
      });
      await this.social.applyDirectoryStats(
        userId,
        platforms,
        connectedAvgViews(platforms) || context.avgViews,
        context.avgEngagementRate,
      );
      await this.social.upsertConnection(userId, 'tiktok', {
        status: 'connected',
        externalAccountId: user.openId,
        handle: parseTikTokHandle(context.tiktok) || user.displayName,
        lastSyncAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const message = error instanceof Error ? error.message : 'TikTok sync failed';
      await this.social.upsertConnection(userId, 'tiktok', {
        status: 'error',
        lastError: message,
      });
      throw new ServiceUnavailableException(message);
    }
  }

  private async syncInstagram(userId: string): Promise<void> {
    const context = await this.requireCreator(userId);
    const connection = await this.social.getConnection(userId, 'instagram');
    const access = this.decrypt(connection?.accessTokenEncrypted);
    if (!access) {
      throw new ServiceUnavailableException('Connect Instagram first.');
    }
    try {
      const user = await fetchInstagramUserStats(access);
      let media: Awaited<ReturnType<typeof fetchInstagramRecentMedia>> = [];
      try {
        media = await fetchInstagramRecentMedia(access);
      } catch {
        // Media list is best-effort.
      }
      if (media.length > 0) {
        await this.social.replaceSyncedPosts(
          userId,
          'instagram',
          media.map((item) => ({
            title: item.title,
            platform: 'Instagram',
            url: item.url,
            postedAt: item.postedAt,
            views: 0,
            likes: item.likes,
            comments: item.comments,
            shares: 0,
            source: 'instagram' as const,
          })),
        );
      }
      const platforms = upsertConnectedPlatform(context.platforms, {
        platform: 'Instagram',
        followers: user.followersCount,
        avgViews: 0,
        engagementRate: 0,
        source: 'instagram',
      });
      await this.social.applyDirectoryStats(
        userId,
        platforms,
        connectedAvgViews(platforms) || context.avgViews,
        context.avgEngagementRate,
      );
      await this.social.upsertConnection(userId, 'instagram', {
        status: 'connected',
        externalAccountId: user.id,
        handle: user.username || parseInstagramHandle(context.instagram) || '',
        lastSyncAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const message =
        error instanceof Error ? error.message : 'Instagram sync failed';
      await this.social.upsertConnection(userId, 'instagram', {
        status: 'error',
        lastError: message,
      });
      throw new ServiceUnavailableException(message);
    }
  }

  private async tiktokAccessToken(userId: string): Promise<string | null> {
    const connection = await this.social.getConnection(userId, 'tiktok');
    let access = this.decrypt(connection?.accessTokenEncrypted);
    if (!access) return null;

    const expiring =
      connection?.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() < Date.now() + 60_000;
    if (!expiring) return access;

    const refresh = this.decrypt(connection?.refreshTokenEncrypted);
    const clientKey = this.config.get<string>('TIKTOK_CLIENT_KEY')?.trim();
    const clientSecret = this.config.get<string>('TIKTOK_CLIENT_SECRET')?.trim();
    if (!refresh || !clientKey || !clientSecret) return access;

    const token = await refreshTikTokToken({
      clientKey,
      clientSecret,
      refreshToken: refresh,
    });
    await this.social.upsertConnection(userId, 'tiktok', {
      accessTokenEncrypted: this.encrypt(token.accessToken),
      refreshTokenEncrypted: token.refreshToken
        ? this.encrypt(token.refreshToken)
        : connection?.refreshTokenEncrypted,
      tokenExpiresAt: token.expiresIn
        ? new Date(Date.now() + token.expiresIn * 1000)
        : connection?.tokenExpiresAt,
    });
    return token.accessToken;
  }

  private async requireCreator(userId: string) {
    const context = await this.social.getCreatorContext(userId);
    if (!context) {
      throw new NotFoundException('User account not found');
    }
    if (context.role !== 'creator') {
      throw new ForbiddenException('Creator account required');
    }
    return context;
  }

  private youtubeApiKey(): string {
    return this.config.get<string>('YOUTUBE_API_KEY')?.trim() || '';
  }

  private providerConfigured(provider: SocialProvider): boolean {
    if (provider === 'youtube') return Boolean(this.youtubeApiKey());
    if (provider === 'tiktok') {
      return Boolean(
        this.config.get<string>('TIKTOK_CLIENT_KEY')?.trim() &&
          this.config.get<string>('TIKTOK_CLIENT_SECRET')?.trim(),
      );
    }
    return Boolean(
      this.config.get<string>('INSTAGRAM_APP_ID')?.trim() &&
        this.config.get<string>('INSTAGRAM_APP_SECRET')?.trim(),
    );
  }

  private tiktokRedirectUri(): string {
    return (
      this.config.get<string>('TIKTOK_REDIRECT_URI')?.trim() ||
      'http://localhost:5010/v1/social/tiktok/callback'
    );
  }

  private instagramRedirectUri(): string {
    return (
      this.config.get<string>('INSTAGRAM_REDIRECT_URI')?.trim() ||
      'http://localhost:5010/v1/social/instagram/callback'
    );
  }

  private webSettingsUrl(): string {
    const base =
      this.config.get<string>('THESI_WEB_URL')?.replace(/\/$/, '') ||
      'http://localhost:3010';
    return `${base}/app/settings/social`;
  }

  private encryptionKey(): string {
    return (
      this.config.get<string>('SOCIAL_TOKEN_ENCRYPTION_KEY')?.trim() ||
      this.config.getOrThrow<string>('JWT_SECRET')
    );
  }

  private encrypt(value: string): string {
    return encryptSecret(value, this.encryptionKey());
  }

  private decrypt(payload: string | null | undefined): string | null {
    if (!payload) return null;
    try {
      return decryptSecret(payload, this.encryptionKey());
    } catch {
      return null;
    }
  }

  private signOauthState(userId: string, provider: 'tiktok' | 'instagram') {
    return this.jwt.signAsync(
      { sub: userId, provider, purpose: 'social-oauth' } satisfies OauthState,
      { expiresIn: '10m' },
    );
  }
}
