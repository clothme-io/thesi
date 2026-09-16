import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type { CreatorPlatformStatsJson } from 'src/dbConfig/drizzle/schema/creatorsDirectorySchema';

export const SOCIAL_REPOSITORY = Symbol('SOCIAL_REPOSITORY');

export type SocialProvider = 'youtube' | 'tiktok' | 'instagram';

export type SocialConnectionRow = {
  id: string;
  creatorUserId: string;
  provider: SocialProvider;
  status: string;
  externalAccountId: string;
  handle: string;
  accessTokenEncrypted: string | null;
  refreshTokenEncrypted: string | null;
  tokenExpiresAt: Date | null;
  scopes: string[];
  lastSyncAt: Date | null;
  lastError: string | null;
};

export type SyncedUgcPost = {
  id?: string;
  title: string;
  platform: string;
  url: string;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  source: SocialProvider;
  externalMediaId?: string;
};

export type CampaignContentRow = {
  id: string;
  campaignId: string;
  creatorUserId: string;
  provider: SocialProvider;
  externalMediaId: string;
  url: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  lastSyncedAt: Date | null;
  lastError: string | null;
};

export type CreatorSocialContext = {
  userId: string;
  role: string;
  youtube: string;
  tiktok: string;
  instagram: string;
  platforms: CreatorPlatformStatsJson[];
  avgViews: number;
  avgEngagementRate: number;
};

export interface SocialRepository {
  getCreatorContext(userId: string): Promise<CreatorSocialContext | null>;
  listConnections(creatorUserId: string): Promise<SocialConnectionRow[]>;
  getConnection(
    creatorUserId: string,
    provider: SocialProvider,
  ): Promise<SocialConnectionRow | null>;
  listConnectedForSync(): Promise<SocialConnectionRow[]>;
  upsertConnection(
    creatorUserId: string,
    provider: SocialProvider,
    patch: Partial<
      Pick<
        SocialConnectionRow,
        | 'status'
        | 'externalAccountId'
        | 'handle'
        | 'accessTokenEncrypted'
        | 'refreshTokenEncrypted'
        | 'tokenExpiresAt'
        | 'scopes'
        | 'lastSyncAt'
        | 'lastError'
      >
    >,
  ): Promise<SocialConnectionRow>;
  applyDirectoryStats(
    creatorUserId: string,
    platforms: CreatorPlatformStatsJson[],
    avgViews: number,
    avgEngagementRate: number,
  ): Promise<void>;
  replaceSyncedPosts(
    creatorUserId: string,
    source: SocialProvider,
    posts: SyncedUgcPost[],
  ): Promise<void>;
  listSyncedPosts(creatorUserId: string): Promise<SyncedUgcPost[]>;
  upsertSyncedPost(creatorUserId: string, post: SyncedUgcPost): Promise<SyncedUgcPost & { id: string }>;
  getSyncedPost(
    creatorUserId: string,
    postId: string,
  ): Promise<(SyncedUgcPost & { id: string }) | null>;
  creatorAcceptedCampaign(
    creatorUserId: string,
    campaignId: string,
  ): Promise<boolean>;
  brandOwnsCampaign(ownerUserId: string, campaignId: string): Promise<boolean>;
  listCampaignContent(campaignId: string): Promise<CampaignContentRow[]>;
  listCampaignContentForSync(): Promise<CampaignContentRow[]>;
  upsertCampaignContent(
    row: Omit<CampaignContentRow, 'id' | 'lastSyncedAt' | 'lastError'> & {
      lastSyncedAt?: Date | null;
      lastError?: string | null;
    },
  ): Promise<CampaignContentRow>;
  getCampaignContent(
    campaignId: string,
    contentId: string,
  ): Promise<CampaignContentRow | null>;
  deleteCampaignContent(
    campaignId: string,
    contentId: string,
    creatorUserId?: string,
  ): Promise<boolean>;
}

@Injectable()
export class PostgresSocialRepository implements SocialRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getCreatorContext(userId: string): Promise<CreatorSocialContext | null> {
    const [user] = await this.db
      .select({
        userId: schema.thesiUser.id,
        role: schema.thesiUser.role,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    if (!user) return null;

    const [profile] = await this.db
      .select({
        youtube: schema.creatorProfile.youtube,
        tiktok: schema.creatorProfile.tiktok,
        instagram: schema.creatorProfile.instagram,
      })
      .from(schema.creatorProfile)
      .where(eq(schema.creatorProfile.userId, userId))
      .limit(1);

    const [stats] = await this.db
      .select()
      .from(schema.creatorDirectoryStats)
      .where(eq(schema.creatorDirectoryStats.creatorUserId, userId))
      .limit(1);

    return {
      userId: user.userId,
      role: user.role,
      youtube: profile?.youtube ?? '',
      tiktok: profile?.tiktok ?? '',
      instagram: profile?.instagram ?? '',
      platforms: Array.isArray(stats?.platforms) ? stats.platforms : [],
      avgViews: stats?.avgViews ?? 0,
      avgEngagementRate: Number(stats?.avgEngagementRate ?? 0),
    };
  }

  async listConnections(creatorUserId: string): Promise<SocialConnectionRow[]> {
    const rows = await this.db
      .select()
      .from(schema.creatorSocialConnection)
      .where(eq(schema.creatorSocialConnection.creatorUserId, creatorUserId));
    return rows.map(mapConnection);
  }

  async getConnection(
    creatorUserId: string,
    provider: SocialProvider,
  ): Promise<SocialConnectionRow | null> {
    const [row] = await this.db
      .select()
      .from(schema.creatorSocialConnection)
      .where(
        and(
          eq(schema.creatorSocialConnection.creatorUserId, creatorUserId),
          eq(schema.creatorSocialConnection.provider, provider),
        ),
      )
      .limit(1);
    return row ? mapConnection(row) : null;
  }

  async listConnectedForSync(): Promise<SocialConnectionRow[]> {
    const rows = await this.db
      .select()
      .from(schema.creatorSocialConnection)
      .where(eq(schema.creatorSocialConnection.status, 'connected'));
    return rows.map(mapConnection);
  }

  async upsertConnection(
    creatorUserId: string,
    provider: SocialProvider,
    patch: Partial<
      Pick<
        SocialConnectionRow,
        | 'status'
        | 'externalAccountId'
        | 'handle'
        | 'accessTokenEncrypted'
        | 'refreshTokenEncrypted'
        | 'tokenExpiresAt'
        | 'scopes'
        | 'lastSyncAt'
        | 'lastError'
      >
    >,
  ): Promise<SocialConnectionRow> {
    const [saved] = await this.db
      .insert(schema.creatorSocialConnection)
      .values({
        creatorUserId,
        provider,
        status: patch.status ?? 'disconnected',
        externalAccountId: patch.externalAccountId ?? '',
        handle: patch.handle ?? '',
        accessTokenEncrypted: patch.accessTokenEncrypted ?? null,
        refreshTokenEncrypted: patch.refreshTokenEncrypted ?? null,
        tokenExpiresAt: patch.tokenExpiresAt ?? null,
        scopes: patch.scopes ?? [],
        lastSyncAt: patch.lastSyncAt ?? null,
        lastError: patch.lastError ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          schema.creatorSocialConnection.creatorUserId,
          schema.creatorSocialConnection.provider,
        ],
        set: {
          ...patch,
          updatedAt: new Date(),
        },
      })
      .returning();
    return mapConnection(saved);
  }

  async applyDirectoryStats(
    creatorUserId: string,
    platforms: CreatorPlatformStatsJson[],
    avgViews: number,
    avgEngagementRate: number,
  ): Promise<void> {
    const totalFollowers = platforms.reduce(
      (sum, row) => sum + (row.followers || 0),
      0,
    );
    await this.db
      .insert(schema.creatorDirectoryStats)
      .values({
        creatorUserId,
        totalFollowers,
        avgViews,
        avgEngagementRate: avgEngagementRate.toFixed(2),
        platforms,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.creatorDirectoryStats.creatorUserId,
        set: {
          totalFollowers,
          avgViews,
          avgEngagementRate: avgEngagementRate.toFixed(2),
          platforms,
          updatedAt: new Date(),
        },
      });
  }

  async replaceSyncedPosts(
    creatorUserId: string,
    source: SocialProvider,
    posts: SyncedUgcPost[],
  ): Promise<void> {
    if (posts.length === 0) {
      await this.db
        .delete(schema.creatorUgcPost)
        .where(
          and(
            eq(schema.creatorUgcPost.creatorUserId, creatorUserId),
            eq(schema.creatorUgcPost.source, source),
          ),
        );
      return;
    }
    for (const post of posts) {
      await this.upsertSyncedPost(creatorUserId, { ...post, source });
    }
  }

  async listSyncedPosts(creatorUserId: string): Promise<SyncedUgcPost[]> {
    const rows = await this.db
      .select()
      .from(schema.creatorUgcPost)
      .where(eq(schema.creatorUgcPost.creatorUserId, creatorUserId));
    return rows
      .filter((row) => row.source !== 'manual')
      .map((row) => mapUgcPost(row));
  }

  async upsertSyncedPost(creatorUserId: string, post: SyncedUgcPost) {
    const mediaId = post.externalMediaId || '';
    const existing = mediaId
      ? await this.db
          .select()
          .from(schema.creatorUgcPost)
          .where(
            and(
              eq(schema.creatorUgcPost.creatorUserId, creatorUserId),
              eq(schema.creatorUgcPost.source, post.source),
              eq(schema.creatorUgcPost.externalMediaId, mediaId),
            ),
          )
          .limit(1)
      : [];
    if (existing[0]) {
      await this.db
        .update(schema.creatorUgcPost)
        .set({
          title: post.title,
          platform: post.platform,
          url: post.url || null,
          postedAt: post.postedAt,
          views: post.views,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
        })
        .where(eq(schema.creatorUgcPost.id, existing[0].id));
      return { ...post, id: existing[0].id };
    }
    const [inserted] = await this.db
      .insert(schema.creatorUgcPost)
      .values({
        creatorUserId,
        title: post.title,
        platform: post.platform,
        url: post.url || null,
        postedAt: post.postedAt,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        source: post.source,
        externalMediaId: mediaId,
      })
      .returning({ id: schema.creatorUgcPost.id });
    return { ...post, id: inserted.id };
  }

  async getSyncedPost(creatorUserId: string, postId: string) {
    const [row] = await this.db
      .select()
      .from(schema.creatorUgcPost)
      .where(
        and(
          eq(schema.creatorUgcPost.id, postId),
          eq(schema.creatorUgcPost.creatorUserId, creatorUserId),
        ),
      )
      .limit(1);
    return row && row.source !== 'manual' ? { ...mapUgcPost(row), id: row.id } : null;
  }

  async creatorAcceptedCampaign(creatorUserId: string, campaignId: string) {
    const [row] = await this.db
      .select({ id: schema.campaignAcceptanceSnapshot.id })
      .from(schema.campaignAcceptanceSnapshot)
      .where(
        and(
          eq(schema.campaignAcceptanceSnapshot.campaignId, campaignId),
          eq(schema.campaignAcceptanceSnapshot.creatorUserId, creatorUserId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async brandOwnsCampaign(ownerUserId: string, campaignId: string) {
    const [row] = await this.db
      .select({ id: schema.campaign.id })
      .from(schema.campaign)
      .where(
        and(
          eq(schema.campaign.id, campaignId),
          eq(schema.campaign.ownerUserId, ownerUserId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async listCampaignContent(campaignId: string) {
    const rows = await this.db
      .select()
      .from(schema.campaignContentMetric)
      .where(eq(schema.campaignContentMetric.campaignId, campaignId));
    return rows.map(mapCampaignContent);
  }

  async listCampaignContentForSync() {
    const rows = await this.db.select().from(schema.campaignContentMetric);
    return rows.map(mapCampaignContent);
  }

  async upsertCampaignContent(
    row: Omit<CampaignContentRow, 'id' | 'lastSyncedAt' | 'lastError'> & {
      lastSyncedAt?: Date | null;
      lastError?: string | null;
    },
  ) {
    const [existing] = await this.db
      .select()
      .from(schema.campaignContentMetric)
      .where(
        and(
          eq(schema.campaignContentMetric.campaignId, row.campaignId),
          eq(schema.campaignContentMetric.creatorUserId, row.creatorUserId),
          eq(schema.campaignContentMetric.provider, row.provider),
          eq(schema.campaignContentMetric.externalMediaId, row.externalMediaId),
        ),
      )
      .limit(1);
    if (existing) {
      const [updated] = await this.db
        .update(schema.campaignContentMetric)
        .set({
          url: row.url,
          title: row.title,
          views: row.views,
          likes: row.likes,
          comments: row.comments,
          lastSyncedAt:
            row.lastSyncedAt === undefined ? new Date() : row.lastSyncedAt,
          lastError: row.lastError ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.campaignContentMetric.id, existing.id))
        .returning();
      return mapCampaignContent(updated);
    }
    const [inserted] = await this.db
      .insert(schema.campaignContentMetric)
      .values({
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
      })
      .returning();
    return mapCampaignContent(inserted);
  }

  async getCampaignContent(campaignId: string, contentId: string) {
    const [row] = await this.db
      .select()
      .from(schema.campaignContentMetric)
      .where(
        and(
          eq(schema.campaignContentMetric.id, contentId),
          eq(schema.campaignContentMetric.campaignId, campaignId),
        ),
      )
      .limit(1);
    return row ? mapCampaignContent(row) : null;
  }

  async deleteCampaignContent(
    campaignId: string,
    contentId: string,
    creatorUserId?: string,
  ) {
    const filters = [
      eq(schema.campaignContentMetric.id, contentId),
      eq(schema.campaignContentMetric.campaignId, campaignId),
    ];
    if (creatorUserId) {
      filters.push(eq(schema.campaignContentMetric.creatorUserId, creatorUserId));
    }
    const deleted = await this.db
      .delete(schema.campaignContentMetric)
      .where(and(...filters))
      .returning({ id: schema.campaignContentMetric.id });
    return deleted.length > 0;
  }
}

function mapConnection(
  row: typeof schema.creatorSocialConnection.$inferSelect,
): SocialConnectionRow {
  return {
    id: row.id,
    creatorUserId: row.creatorUserId,
    provider: row.provider as SocialProvider,
    status: row.status,
    externalAccountId: row.externalAccountId,
    handle: row.handle,
    accessTokenEncrypted: row.accessTokenEncrypted,
    refreshTokenEncrypted: row.refreshTokenEncrypted,
    tokenExpiresAt: row.tokenExpiresAt,
    scopes: Array.isArray(row.scopes) ? row.scopes : [],
    lastSyncAt: row.lastSyncAt,
    lastError: row.lastError,
  };
}

function mapUgcPost(
  row: typeof schema.creatorUgcPost.$inferSelect,
): SyncedUgcPost {
  return {
    id: row.id,
    title: row.title,
    platform: row.platform,
    url: row.url || '',
    postedAt: String(row.postedAt).slice(0, 10),
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    source: row.source as SocialProvider,
    externalMediaId: row.externalMediaId || '',
  };
}

function mapCampaignContent(
  row: typeof schema.campaignContentMetric.$inferSelect,
): CampaignContentRow {
  return {
    id: row.id,
    campaignId: row.campaignId,
    creatorUserId: row.creatorUserId,
    provider: row.provider as SocialProvider,
    externalMediaId: row.externalMediaId,
    url: row.url,
    title: row.title,
    views: row.views,
    likes: row.likes,
    comments: row.comments,
    lastSyncedAt: row.lastSyncedAt,
    lastError: row.lastError,
  };
}
