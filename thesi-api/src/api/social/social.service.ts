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
import { workspaceResourceOwner } from '../brand-workspaces/workspace-context';
import {
  exchangeInstagramCode,
  exchangeInstagramLongLivedToken,
  fetchInstagramMediaViews,
  fetchInstagramRecentMedia,
  fetchInstagramUserStats,
  instagramAuthorizeUrl,
  refreshInstagramLongLivedToken,
} from './instagram.client';
import {
  parseInstagramHandle,
  parseInstagramShortcode,
  parseSocialContentUrl,
  parseTikTokHandle,
  parseYouTubeChannelRef,
} from './parse-social-handle';
import {
  connectedAvgViews,
  engagementRateFromPosts,
  upsertConnectedPlatform,
} from './social-stats.util';
import {
  SOCIAL_REPOSITORY,
  type CampaignContentRow,
  type SocialProvider,
  type SocialRepository,
} from './social.repository';
import { decryptSecret, encryptSecret } from './token-crypto';
import {
  exchangeTikTokCode,
  fetchTikTokRecentVideos,
  fetchTikTokUserStats,
  fetchTikTokVideosByIds,
  refreshTikTokToken,
  tiktokAuthorizeUrl,
} from './tiktok.client';
import {
  exchangeYouTubeCode,
  fetchYouTubeMineChannel,
  fetchYouTubeRecentVideos,
  fetchYouTubeVideosByIds,
  refreshYouTubeToken,
  youtubeAuthorizeUrl,
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
  provider: SocialProvider;
  purpose: 'social-oauth';
};

export type SocialContentMetrics = {
  provider: SocialProvider;
  mediaId: string;
  title: string;
  url: string;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
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
      youtubeConfigured: this.googleOAuthConfigured(),
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
    if (!this.googleOAuthConfigured()) {
      throw new ServiceUnavailableException(
        'YouTube is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and YOUTUBE_REDIRECT_URI.',
      );
    }
    const access = await this.youtubeAccessToken(userId);
    if (!access) {
      throw new ServiceUnavailableException('Connect YouTube first.');
    }
    try {
      const channel = await fetchYouTubeMineChannel(access);
      let avgViews = 0;
      let videos: Awaited<ReturnType<typeof fetchYouTubeRecentVideos>> = [];
      try {
        videos = channel.uploadsPlaylistId
          ? await fetchYouTubeRecentVideos(
              { accessToken: access },
              channel.uploadsPlaylistId,
            )
          : [];
        if (videos.length > 0) {
          avgViews = Math.round(
            videos.reduce((sum, video) => sum + video.views, 0) / videos.length,
          );
          await this.social.replaceSyncedPosts(
            userId,
            'youtube',
            videos.map((video) => ({
              title: video.title,
              url: video.url,
              postedAt: video.postedAt,
              views: video.views,
              likes: video.likes,
              comments: video.comments,
              shares: 0,
              platform: 'YouTube',
              source: 'youtube' as const,
              externalMediaId: video.id,
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
      await this.persistDirectoryStats(
        userId,
        platforms,
        context.avgViews,
        context.avgEngagementRate,
      );
      const profileRef = parseYouTubeChannelRef(context.youtube);
      const mismatch =
        profileRef &&
        ((profileRef.kind === 'id' && profileRef.id !== channel.channelId) ||
          (profileRef.kind === 'handle' &&
            channel.handle &&
            profileRef.handle.toLowerCase() !== channel.handle.toLowerCase()));
      await this.social.upsertConnection(userId, 'youtube', {
        status: 'connected',
        externalAccountId: channel.channelId,
        handle: channel.handle,
        lastSyncAt: new Date(),
        lastError: mismatch
          ? 'Profile YouTube URL does not match the connected channel. Stats are from the connected Google account.'
          : null,
      });
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      const message = error instanceof Error ? error.message : 'YouTube sync failed';
      await this.social.upsertConnection(userId, 'youtube', {
        status: 'error',
        lastError: message,
      });
      throw new ServiceUnavailableException(message);
    }
    return this.listAccounts(userId);
  }

  async youtubeConnectUrl(userId: string): Promise<{ url: string }> {
    await this.requireCreator(userId);
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const redirectUri = this.youtubeRedirectUri();
    if (!clientId || !this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim()) {
      throw new ServiceUnavailableException(
        'YouTube is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and YOUTUBE_REDIRECT_URI.',
      );
    }
    const state = await this.signOauthState(userId, 'youtube');
    return { url: youtubeAuthorizeUrl({ clientId, redirectUri, state }) };
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
    provider: SocialProvider,
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
      } else if (provider === 'instagram') {
        await this.finishInstagram(userId, code);
      } else {
        await this.finishYouTube(userId, code);
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
    await this.persistDirectoryStats(
        userId,
        platforms,
        context.avgViews,
        context.avgEngagementRate,
      );
    return this.listAccounts(userId);
  }

  async syncAllForUser(userId: string): Promise<{ accounts: SocialAccountStatus[] }> {
    const listed = await this.listAccounts(userId);
    for (const account of listed.accounts) {
      if (account.provider === 'youtube' && account.status === 'connected') {
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

  async cronSyncAll(): Promise<{ synced: number; content: number }> {
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
    const contentRows = await this.social.listCampaignContentForSync();
    let content = 0;
    for (const row of contentRows) {
      try {
        await this.refreshCampaignContentRow(row);
        content += 1;
      } catch {
        // lastError stored per row
      }
    }
    return { synced, content };
  }

  async listImportedContent(userId: string) {
    await this.requireCreator(userId);
    const posts = await this.social.listSyncedPosts(userId);
    return {
      posts: posts.map((post) => ({
        id: post.id || '',
        title: post.title,
        platform: post.platform,
        url: post.url,
        postedAt: post.postedAt,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        source: post.source,
        mediaId: post.externalMediaId || '',
      })),
    };
  }

  async lookupContent(userId: string, url: string): Promise<SocialContentMetrics> {
    await this.requireCreator(userId);
    return this.fetchOwnedContent(userId, url);
  }

  async importContent(userId: string, url: string) {
    await this.requireCreator(userId);
    const metrics = await this.fetchOwnedContent(userId, url);
    const saved = await this.social.upsertSyncedPost(userId, {
      title: metrics.title,
      platform: this.platformLabel(metrics.provider),
      url: metrics.url,
      postedAt: metrics.postedAt,
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      shares: 0,
      source: metrics.provider,
      externalMediaId: metrics.mediaId,
    });
    const context = await this.requireCreator(userId);
    await this.persistDirectoryStats(
      userId,
      context.platforms,
      context.avgViews,
      context.avgEngagementRate,
    );
    return { post: { ...saved, id: saved.id } };
  }

  async refreshImportedContent(userId: string, postId: string) {
    await this.requireCreator(userId);
    const existing = await this.social.getSyncedPost(userId, postId);
    if (!existing?.url) {
      throw new NotFoundException('Imported post not found');
    }
    return this.importContent(userId, existing.url);
  }

  async listCampaignContent(userId: string, role: string, campaignId: string) {
    await this.assertCampaignContentAccess(userId, role, campaignId);
    const items = await this.social.listCampaignContent(campaignId);
    if (role !== 'brand') {
      return { items: items.filter((item) => item.creatorUserId === userId) };
    }
    return { items };
  }

  async attachCampaignContent(
    userId: string,
    role: string,
    campaignId: string,
    url: string,
  ) {
    await this.requireCreator(userId);
    if (role === 'brand') {
      throw new ForbiddenException('Creators attach published posts');
    }
    await this.assertCampaignContentAccess(userId, role, campaignId);
    const metrics = await this.fetchOwnedContent(userId, url);
    const row = await this.social.upsertCampaignContent({
      campaignId,
      creatorUserId: userId,
      provider: metrics.provider,
      externalMediaId: metrics.mediaId,
      url: metrics.url,
      title: metrics.title,
      views: metrics.views,
      likes: metrics.likes,
      comments: metrics.comments,
      lastSyncedAt: new Date(),
    });
    return { item: row };
  }

  async refreshCampaignContent(
    userId: string,
    role: string,
    campaignId: string,
    contentId: string,
  ) {
    await this.assertCampaignContentAccess(userId, role, campaignId);
    const existing = await this.social.getCampaignContent(campaignId, contentId);
    if (!existing) throw new NotFoundException('Published post not found');
    if (role !== 'brand' && existing.creatorUserId !== userId) {
      throw new ForbiddenException('You can only refresh your own posts');
    }
    const row = await this.refreshCampaignContentRow(existing);
    return { item: row };
  }

  async detachCampaignContent(
    userId: string,
    role: string,
    campaignId: string,
    contentId: string,
  ) {
    await this.assertCampaignContentAccess(userId, role, campaignId);
    const existing = await this.social.getCampaignContent(campaignId, contentId);
    if (!existing) throw new NotFoundException('Published post not found');
    const creatorOnly = role === 'brand' ? undefined : userId;
    if (role !== 'brand' && existing.creatorUserId !== userId) {
      throw new ForbiddenException('You can only remove your own posts');
    }
    await this.social.deleteCampaignContent(campaignId, contentId, creatorOnly);
    return { ok: true };
  }

  private async assertCampaignContentAccess(
    userId: string,
    role: string,
    campaignId: string,
  ) {
    if (role === 'brand') {
      const owner = workspaceResourceOwner(userId);
      const owns = await this.social.brandOwnsCampaign(owner, campaignId);
      if (!owns) throw new ForbiddenException('Campaign not found');
      return;
    }
    await this.requireCreator(userId);
    const accepted = await this.social.creatorAcceptedCampaign(userId, campaignId);
    if (!accepted) {
      throw new ForbiddenException(
        'Accept the campaign before attaching published posts',
      );
    }
  }

  private async refreshCampaignContentRow(row: CampaignContentRow) {
    try {
      const metrics = await this.fetchOwnedContent(row.creatorUserId, row.url);
      return this.social.upsertCampaignContent({
        campaignId: row.campaignId,
        creatorUserId: row.creatorUserId,
        provider: metrics.provider,
        externalMediaId: metrics.mediaId,
        url: metrics.url,
        title: metrics.title,
        views: metrics.views,
        likes: metrics.likes,
        comments: metrics.comments,
        lastSyncedAt: new Date(),
        lastError: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Could not refresh stats';
      return this.social.upsertCampaignContent({
        campaignId: row.campaignId,
        creatorUserId: row.creatorUserId,
        provider: row.provider,
        externalMediaId: row.externalMediaId,
        url: row.url,
        title: row.title,
        views: row.views,
        likes: row.likes,
        comments: row.comments,
        lastSyncedAt: row.lastSyncedAt,
        lastError: message,
      });
    }
  }

  private async fetchOwnedContent(
    userId: string,
    url: string,
  ): Promise<SocialContentMetrics> {
    const parsed = parseSocialContentUrl(url);
    if (!parsed) {
      throw new BadRequestException(
        'Paste a TikTok, Instagram, or YouTube post URL',
      );
    }
    if (parsed.provider === 'youtube') {
      const access = await this.youtubeAccessToken(userId);
      const connection = await this.social.getConnection(userId, 'youtube');
      if (!access || connection?.status !== 'connected') {
        throw new ServiceUnavailableException('Connect YouTube first.');
      }
      const [video] = await fetchYouTubeVideosByIds({ accessToken: access }, [
        parsed.mediaId,
      ]);
      if (!video) {
        throw new NotFoundException('YouTube video not found');
      }
      if (
        video.channelId &&
        connection.externalAccountId &&
        video.channelId !== connection.externalAccountId
      ) {
        throw new ForbiddenException(
          'That YouTube video is not from the connected channel',
        );
      }
      return {
        provider: 'youtube',
        mediaId: video.id,
        title: video.title,
        url: video.url,
        postedAt: video.postedAt,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
      };
    }
    if (parsed.provider === 'tiktok') {
      const access = await this.tiktokAccessToken(userId);
      if (!access) {
        throw new ServiceUnavailableException('Connect TikTok first.');
      }
      const [video] = await fetchTikTokVideosByIds(access, [parsed.mediaId]);
      if (!video?.id) {
        throw new ForbiddenException(
          'That TikTok video is not on the connected account',
        );
      }
      return {
        provider: 'tiktok',
        mediaId: video.id,
        title: video.title,
        url: video.url || url,
        postedAt: video.postedAt,
        views: video.views,
        likes: video.likes,
        comments: video.comments,
      };
    }
    const access = await this.instagramAccessToken(userId);
    if (!access) {
      throw new ServiceUnavailableException('Connect Instagram first.');
    }
    const shortcode = parseInstagramShortcode(url);
    const media = await fetchInstagramRecentMedia(access, fetch, 50);
    const match = media.find(
      (item) =>
        item.id === parsed.mediaId ||
        (shortcode && item.url.includes(`/${shortcode}`)),
    );
    if (!match) {
      throw new ForbiddenException(
        'That Instagram post was not found on the connected account. It may be older than the last 50 posts.',
      );
    }
    const views =
      match.views ||
      (await fetchInstagramMediaViews(access, match.id));
    return {
      provider: 'instagram',
      mediaId: match.id,
      title: match.title,
      url: match.url || url,
      postedAt: match.postedAt,
      views,
      likes: match.likes,
      comments: match.comments,
    };
  }

  private platformLabel(provider: SocialProvider) {
    if (provider === 'youtube') return 'YouTube';
    if (provider === 'tiktok') return 'TikTok';
    return 'Instagram';
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

  private async finishYouTube(userId: string, code: string): Promise<void> {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();
    const redirectUri = this.youtubeRedirectUri();
    if (!clientId || !clientSecret) {
      throw new Error('YouTube is not configured');
    }
    const token = await exchangeYouTubeCode({
      clientId,
      clientSecret,
      code,
      redirectUri,
    });
    await this.social.upsertConnection(userId, 'youtube', {
      status: 'connected',
      accessTokenEncrypted: this.encrypt(token.accessToken),
      refreshTokenEncrypted: token.refreshToken
        ? this.encrypt(token.refreshToken)
        : null,
      tokenExpiresAt: token.expiresIn
        ? new Date(Date.now() + token.expiresIn * 1000)
        : null,
      scopes: token.scope ? token.scope.split(/[,\s]+/).filter(Boolean) : [],
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
              title: video.title,
              url: video.url,
              postedAt: video.postedAt,
              views: video.views,
              likes: video.likes,
              comments: video.comments,
              shares: video.shares,
              platform: 'TikTok',
              source: 'tiktok' as const,
              externalMediaId: video.id,
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
      await this.persistDirectoryStats(
        userId,
        platforms,
        context.avgViews,
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
    const access = await this.instagramAccessToken(userId);
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
            views: item.views,
            likes: item.likes,
            comments: item.comments,
            shares: 0,
            source: 'instagram' as const,
            externalMediaId: item.id,
          })),
        );
      }
      const avgViews =
        media.length > 0
          ? Math.round(
              media.reduce((sum, item) => sum + item.views, 0) / media.length,
            )
          : 0;
      const platforms = upsertConnectedPlatform(context.platforms, {
        platform: 'Instagram',
        followers: user.followersCount,
        avgViews,
        engagementRate: 0,
        source: 'instagram',
      });
      await this.persistDirectoryStats(
        userId,
        platforms,
        context.avgViews,
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

  private async instagramAccessToken(userId: string): Promise<string | null> {
    const connection = await this.social.getConnection(userId, 'instagram');
    let access = this.decrypt(connection?.accessTokenEncrypted);
    if (!access) return null;
    const expiring =
      !connection?.tokenExpiresAt ||
      connection.tokenExpiresAt.getTime() < Date.now() + 7 * 24 * 60 * 60 * 1000;
    if (!expiring) return access;
    try {
      const token = await refreshInstagramLongLivedToken(access);
      await this.social.upsertConnection(userId, 'instagram', {
        accessTokenEncrypted: this.encrypt(token.accessToken),
        tokenExpiresAt: token.expiresIn
          ? new Date(Date.now() + token.expiresIn * 1000)
          : connection?.tokenExpiresAt,
      });
      return token.accessToken;
    } catch {
      return access;
    }
  }

  private async youtubeAccessToken(userId: string): Promise<string | null> {
    const connection = await this.social.getConnection(userId, 'youtube');
    let access = this.decrypt(connection?.accessTokenEncrypted);
    if (!access) return null;
    const expiring =
      connection?.tokenExpiresAt &&
      connection.tokenExpiresAt.getTime() < Date.now() + 60_000;
    if (!expiring) return access;
    const refresh = this.decrypt(connection?.refreshTokenEncrypted);
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID')?.trim();
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim();
    if (!refresh || !clientId || !clientSecret) return access;
    const token = await refreshYouTubeToken({
      clientId,
      clientSecret,
      refreshToken: refresh,
    });
    await this.social.upsertConnection(userId, 'youtube', {
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

  private async persistDirectoryStats(
    userId: string,
    platforms: ReturnType<typeof upsertConnectedPlatform>,
    fallbackAvgViews: number,
    fallbackEngagement = 0,
  ) {
    const posts = await this.social.listSyncedPosts(userId);
    const engagement = engagementRateFromPosts(posts);
    await this.social.applyDirectoryStats(
      userId,
      platforms,
      connectedAvgViews(platforms) || fallbackAvgViews,
      engagement > 0 ? engagement : fallbackEngagement,
    );
  }

  private googleOAuthConfigured(): boolean {
    return Boolean(
      this.config.get<string>('GOOGLE_CLIENT_ID')?.trim() &&
        this.config.get<string>('GOOGLE_CLIENT_SECRET')?.trim(),
    );
  }

  private providerConfigured(provider: SocialProvider): boolean {
    if (provider === 'youtube') return this.googleOAuthConfigured();
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

  private youtubeRedirectUri(): string {
    return (
      this.config.get<string>('YOUTUBE_REDIRECT_URI')?.trim() ||
      'http://localhost:5010/v1/social/youtube/callback'
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

  private signOauthState(userId: string, provider: SocialProvider) {
    return this.jwt.signAsync(
      { sub: userId, provider, purpose: 'social-oauth' } satisfies OauthState,
      { expiresIn: '10m' },
    );
  }
}
