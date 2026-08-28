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
  title: string;
  platform: string;
  url: string;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  source: SocialProvider;
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
    await this.db
      .delete(schema.creatorUgcPost)
      .where(
        and(
          eq(schema.creatorUgcPost.creatorUserId, creatorUserId),
          eq(schema.creatorUgcPost.source, source),
        ),
      );
    if (posts.length === 0) return;
    await this.db.insert(schema.creatorUgcPost).values(
      posts.map((post) => ({
        creatorUserId,
        title: post.title,
        platform: post.platform,
        url: post.url || null,
        postedAt: post.postedAt,
        views: post.views,
        likes: post.likes,
        comments: post.comments,
        shares: post.shares,
        source,
      })),
    );
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
