import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import {
  averageUgcViews,
  nativeStatsFromInvites,
} from 'src/api/profiles/follower-range.util';
import type {
  CreatorDirectoryProfile,
  CreatorPlatformStats,
  CreatorUgcPost,
  CreatorsDirectoryRepository,
  DirectoryUser,
} from './creators-directory.repository';

@Injectable()
export class PostgresCreatorsDirectoryRepository
  implements CreatorsDirectoryRepository
{
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string): Promise<DirectoryUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return user ?? null;
  }

  async listCreators(): Promise<CreatorDirectoryProfile[]> {
    const rows = await this.db
      .select({
        userId: schema.thesiUser.id,
        email: schema.thesiUser.email,
        fullName: schema.thesiUser.fullName,
        displayName: schema.creatorProfile.displayName,
        bio: schema.creatorProfile.bio,
        location: schema.creatorProfile.location,
        niches: schema.creatorProfile.niches,
        platforms: schema.creatorProfile.platforms,
        followerRange: schema.creatorProfile.followerRange,
        instagram: schema.creatorProfile.instagram,
        tiktok: schema.creatorProfile.tiktok,
        youtube: schema.creatorProfile.youtube,
      })
      .from(schema.thesiUser)
      .innerJoin(
        schema.creatorProfile,
        eq(schema.creatorProfile.userId, schema.thesiUser.id),
      )
      .where(eq(schema.thesiUser.role, 'creator'))
      .orderBy(schema.creatorProfile.displayName);

    return Promise.all(rows.map((row) => this.hydrateCreator(row)));
  }

  async getCreator(
    creatorUserId: string,
  ): Promise<CreatorDirectoryProfile | null> {
    const [row] = await this.db
      .select({
        userId: schema.thesiUser.id,
        email: schema.thesiUser.email,
        fullName: schema.thesiUser.fullName,
        displayName: schema.creatorProfile.displayName,
        bio: schema.creatorProfile.bio,
        location: schema.creatorProfile.location,
        niches: schema.creatorProfile.niches,
        platforms: schema.creatorProfile.platforms,
        followerRange: schema.creatorProfile.followerRange,
        instagram: schema.creatorProfile.instagram,
        tiktok: schema.creatorProfile.tiktok,
        youtube: schema.creatorProfile.youtube,
      })
      .from(schema.thesiUser)
      .innerJoin(
        schema.creatorProfile,
        eq(schema.creatorProfile.userId, schema.thesiUser.id),
      )
      .where(
        and(
          eq(schema.thesiUser.id, creatorUserId),
          eq(schema.thesiUser.role, 'creator'),
        ),
      )
      .limit(1);

    return row ? this.hydrateCreator(row) : null;
  }

  async listFavoriteIds(brandUserId: string): Promise<string[]> {
    const rows = await this.db
      .select({
        creatorUserId: schema.brandCreatorFavorite.creatorUserId,
      })
      .from(schema.brandCreatorFavorite)
      .where(eq(schema.brandCreatorFavorite.brandUserId, brandUserId))
      .orderBy(desc(schema.brandCreatorFavorite.createdAt));
    return rows.map((row) => row.creatorUserId);
  }

  async addFavorite(brandUserId: string, creatorUserId: string): Promise<void> {
    await this.db
      .insert(schema.brandCreatorFavorite)
      .values({ brandUserId, creatorUserId })
      .onConflictDoNothing();
  }

  async removeFavorite(
    brandUserId: string,
    creatorUserId: string,
  ): Promise<void> {
    await this.db
      .delete(schema.brandCreatorFavorite)
      .where(
        and(
          eq(schema.brandCreatorFavorite.brandUserId, brandUserId),
          eq(schema.brandCreatorFavorite.creatorUserId, creatorUserId),
        ),
      );
  }

  async creatorExists(creatorUserId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.thesiUser.id })
      .from(schema.thesiUser)
      .innerJoin(
        schema.creatorProfile,
        eq(schema.creatorProfile.userId, schema.thesiUser.id),
      )
      .where(
        and(
          eq(schema.thesiUser.id, creatorUserId),
          eq(schema.thesiUser.role, 'creator'),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  private async hydrateCreator(row: {
    userId: string;
    email: string;
    fullName: string;
    displayName: string;
    bio: string;
    location: string;
    niches: string[];
    platforms: string[];
    followerRange: string;
    instagram: string;
    tiktok: string;
    youtube: string;
  }): Promise<CreatorDirectoryProfile> {
    const [statsRow] = await this.db
      .select()
      .from(schema.creatorDirectoryStats)
      .where(eq(schema.creatorDirectoryStats.creatorUserId, row.userId))
      .limit(1);

    const ugcRows = await this.db
      .select()
      .from(schema.creatorUgcPost)
      .where(eq(schema.creatorUgcPost.creatorUserId, row.userId))
      .orderBy(desc(schema.creatorUgcPost.postedAt));

    const platforms =
      row.platforms?.length > 0
        ? row.platforms
        : derivePlatformsFromSocials(row);

    const platformStats: CreatorPlatformStats[] = Array.isArray(
      statsRow?.platforms,
    )
      ? statsRow.platforms
      : platforms.map((platform) => ({
          platform,
          followers: 0,
          avgViews: 0,
          engagementRate: 0,
        }));

    const ugcPosts: CreatorUgcPost[] = ugcRows.map((post) => ({
      id: post.id,
      creatorId: post.creatorUserId,
      title: post.title,
      platform: post.platform,
      ...(post.campaignName ? { campaignName: post.campaignName } : {}),
      ...(post.brandName ? { brandName: post.brandName } : {}),
      ...(post.url ? { url: post.url } : {}),
      ...(post.source ? { source: post.source } : {}),
      postedAt: postedAtToString(post.postedAt),
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      saves: post.saves,
    }));

    const connectionRows = await this.db
      .select({
        lastSyncAt: schema.creatorSocialConnection.lastSyncAt,
      })
      .from(schema.creatorSocialConnection)
      .where(eq(schema.creatorSocialConnection.creatorUserId, row.userId));
    const syncTimes = connectionRows
      .map((connection) => connection.lastSyncAt)
      .filter((value): value is Date => value instanceof Date);
    const statsSyncedAt =
      syncTimes.length > 0
        ? new Date(
            Math.max(...syncTimes.map((value) => value.getTime())),
          ).toISOString()
        : null;

    const inviteRows = await this.db
      .select({ status: schema.campaignInvite.status })
      .from(schema.campaignInvite)
      .where(
        or(
          eq(schema.campaignInvite.creatorUserId, row.userId),
          sql`lower(${schema.campaignInvite.creatorEmail}) = ${row.email.toLowerCase()}`,
        ),
      );
    const native = nativeStatsFromInvites(inviteRows.map((invite) => invite.status));
    const storedAvgViews = statsRow?.avgViews ?? 0;

    return {
      id: row.userId,
      name: row.displayName || row.fullName,
      email: row.email,
      niches: row.niches ?? [],
      location: row.location ?? '',
      platforms,
      followerRange: row.followerRange || '',
      bio: row.bio || '',
      statsSyncedAt,
      stats: {
        totalFollowers: statsRow?.totalFollowers ?? 0,
        avgViews: storedAvgViews || averageUgcViews(ugcPosts),
        avgEngagementRate: Number(statsRow?.avgEngagementRate ?? 0),
        completedCampaigns: native.completedCampaigns,
        responseRate: native.responseRate,
        platforms: platformStats,
      },
      ugcPosts,
    };
  }
}

function postedAtToString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function derivePlatformsFromSocials(row: {
  instagram: string;
  tiktok: string;
  youtube: string;
}): string[] {
  const platforms: string[] = [];
  if (row.tiktok?.trim()) platforms.push('TikTok');
  if (row.instagram?.trim()) platforms.push('Instagram');
  if (row.youtube?.trim()) platforms.push('YouTube');
  return platforms;
}
