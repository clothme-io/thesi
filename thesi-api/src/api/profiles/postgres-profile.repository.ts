import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { v4 as uuidv4 } from 'uuid';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import {
  connectedAvgViews,
  isConnectedSource,
  mergePlatformStats,
  totalFollowersFrom,
} from 'src/api/social/social-stats.util';
import type { CreatorUgcPostInputDto } from './dto/profile.dto';
import {
  buildSelfReportedStats,
  derivePlatformsFromSocials,
  mapApplicationFollowerRange,
} from './follower-range.util';
import type {
  BrandLogoData,
  BrandLogoRef,
  BrandProfileData,
  CreatorProfileImageData,
  CreatorProfileImageRef,
  CreatorProfileData,
  ProfileRepository,
  ProfileUser,
} from './profile.repository';

const MAX_UGC_POSTS = 12;

@Injectable()
export class PostgresProfileRepository implements ProfileRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string): Promise<ProfileUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
        fullName: schema.thesiUser.fullName,
        companyName: schema.thesiUser.companyName,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return user ?? null;
  }

  async getCreatorProfile(
    userId: string,
  ): Promise<CreatorProfileData | null> {
    const [profile] = await this.db
      .select()
      .from(schema.creatorProfile)
      .where(eq(schema.creatorProfile.userId, userId))
      .limit(1);
    if (!profile) return null;

    const [statsRow] = await this.db
      .select()
      .from(schema.creatorDirectoryStats)
      .where(eq(schema.creatorDirectoryStats.creatorUserId, userId))
      .limit(1);

    const ugcRows = await this.db
      .select()
      .from(schema.creatorUgcPost)
      .where(eq(schema.creatorUgcPost.creatorUserId, userId))
      .orderBy(desc(schema.creatorUgcPost.postedAt));

    return mapCreatorProfile(profile, statsRow ?? null, ugcRows);
  }

  async getCreatorProfileImage(
    userId: string,
  ): Promise<CreatorProfileImageRef | null> {
    const [profile] = await this.db
      .select({
        storageProvider: schema.creatorProfile.profileImageStorageProvider,
        storageKey: schema.creatorProfile.profileImageStorageKey,
        contentType: schema.creatorProfile.profileImageContentType,
      })
      .from(schema.creatorProfile)
      .where(eq(schema.creatorProfile.userId, userId))
      .limit(1);

    if (
      !profile?.storageProvider ||
      !profile.storageKey ||
      !profile.contentType
    ) {
      return null;
    }

    return {
      storageProvider: profile.storageProvider as CreatorProfileImageRef['storageProvider'],
      storageKey: profile.storageKey,
      contentType: profile.contentType,
    };
  }

  async getBrandProfile(userId: string): Promise<BrandProfileData | null> {
    const [profile] = await this.db
      .select()
      .from(schema.brandProfile)
      .where(eq(schema.brandProfile.userId, userId))
      .limit(1);
    return profile ? mapBrandProfile(profile) : null;
  }

  async getBrandLogo(userId: string): Promise<BrandLogoRef | null> {
    const [profile] = await this.db
      .select({
        storageProvider: schema.brandProfile.logoStorageProvider,
        storageKey: schema.brandProfile.logoStorageKey,
        contentType: schema.brandProfile.logoContentType,
      })
      .from(schema.brandProfile)
      .where(eq(schema.brandProfile.userId, userId))
      .limit(1);

    if (
      !profile?.storageProvider ||
      !profile.storageKey ||
      !profile.contentType
    ) {
      return null;
    }

    return {
      storageProvider: profile.storageProvider as BrandLogoRef['storageProvider'],
      storageKey: profile.storageKey,
      contentType: profile.contentType,
    };
  }

  async upsertCreatorProfile(
    userId: string,
    profile: CreatorProfileData,
  ): Promise<CreatorProfileData> {
    const platforms = derivePlatformsFromSocials(profile);
    const followerRange = mapApplicationFollowerRange(profile.followerRange);
    const stats = buildSelfReportedStats({
      ...profile,
      tiktokFollowers: profile.tiktokFollowers || 0,
      instagramFollowers: profile.instagramFollowers || 0,
      youtubeFollowers: profile.youtubeFollowers || 0,
      avgViews: profile.avgViews || 0,
      avgEngagementRate: profile.avgEngagementRate || 0,
    });
    const posts = completeUgcPosts(profile.ugcPosts);

    return this.db.transaction(async (tx) => {
      const [saved] = await tx
        .insert(schema.creatorProfile)
        .values({
          userId,
          displayName: profile.displayName,
          headline: profile.headline,
          bio: profile.bio,
          location: profile.location,
          website: profile.website,
          instagram: profile.instagram,
          tiktok: profile.tiktok,
          youtube: profile.youtube,
          niches: profile.niches,
          rateRange: profile.rateRange,
          turnaround: profile.turnaround,
          portfolioUrl: profile.portfolioUrl,
          profileImageUrl: profile.profileImageUrl ?? '',
          platforms,
          followerRange,
        })
        .onConflictDoUpdate({
          target: schema.creatorProfile.userId,
          set: {
            displayName: profile.displayName,
            headline: profile.headline,
            bio: profile.bio,
            location: profile.location,
            website: profile.website,
            instagram: profile.instagram,
            tiktok: profile.tiktok,
            youtube: profile.youtube,
            niches: profile.niches,
            rateRange: profile.rateRange,
            turnaround: profile.turnaround,
            portfolioUrl: profile.portfolioUrl,
            profileImageUrl: profile.profileImageUrl ?? '',
            platforms,
            followerRange,
            updatedAt: new Date(),
          },
        })
        .returning();

      const [existingStats] = await tx
        .select()
        .from(schema.creatorDirectoryStats)
        .where(eq(schema.creatorDirectoryStats.creatorUserId, userId))
        .limit(1);
      const mergedPlatforms = mergePlatformStats(
        stats.platforms.map((row) => ({
          ...row,
          source: 'self_reported' as const,
        })),
        existingStats?.platforms,
      );
      const avgViews =
        connectedAvgViews(mergedPlatforms) || stats.avgViews;
      const totalFollowers = totalFollowersFrom(mergedPlatforms);

      await tx
        .insert(schema.creatorDirectoryStats)
        .values({
          creatorUserId: userId,
          totalFollowers,
          avgViews,
          avgEngagementRate: stats.avgEngagementRate.toFixed(2),
          completedCampaigns: 0,
          responseRate: 0,
          platforms: mergedPlatforms,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: schema.creatorDirectoryStats.creatorUserId,
          set: {
            totalFollowers,
            avgViews,
            avgEngagementRate: stats.avgEngagementRate.toFixed(2),
            platforms: mergedPlatforms,
            updatedAt: new Date(),
          },
        });

      await tx
        .delete(schema.creatorUgcPost)
        .where(
          and(
            eq(schema.creatorUgcPost.creatorUserId, userId),
            eq(schema.creatorUgcPost.source, 'manual'),
          ),
        );

      if (posts.length > 0) {
        await tx.insert(schema.creatorUgcPost).values(
          posts.map((post) => ({
            id: post.id || uuidv4(),
            creatorUserId: userId,
            title: post.title.trim(),
            platform: post.platform,
            url: post.url?.trim() || null,
            postedAt: post.postedAt,
            views: post.views || 0,
            likes: post.likes || 0,
            comments: post.comments || 0,
            shares: post.shares || 0,
            saves: post.saves || 0,
            campaignName: post.campaignName?.trim() || null,
            brandName: post.brandName?.trim() || null,
            source: 'manual',
          })),
        );
      }

      const ugcRows = await tx
        .select()
        .from(schema.creatorUgcPost)
        .where(eq(schema.creatorUgcPost.creatorUserId, userId))
        .orderBy(desc(schema.creatorUgcPost.postedAt));

      const [statsRow] = await tx
        .select()
        .from(schema.creatorDirectoryStats)
        .where(eq(schema.creatorDirectoryStats.creatorUserId, userId))
        .limit(1);

      return mapCreatorProfile(saved, statsRow ?? null, ugcRows);
    });
  }

  async setCreatorProfileImage(
    userId: string,
    image: CreatorProfileImageData,
  ): Promise<CreatorProfileData | null> {
    const [saved] = await this.db
      .update(schema.creatorProfile)
      .set({
        profileImageUrl: image.profileImageUrl,
        profileImageStorageProvider: image.storageProvider,
        profileImageStorageKey: image.storageKey,
        profileImageContentType: image.contentType,
        updatedAt: new Date(),
      })
      .where(eq(schema.creatorProfile.userId, userId))
      .returning();

    if (!saved) return null;

    const [statsRow] = await this.db
      .select()
      .from(schema.creatorDirectoryStats)
      .where(eq(schema.creatorDirectoryStats.creatorUserId, userId))
      .limit(1);

    const ugcRows = await this.db
      .select()
      .from(schema.creatorUgcPost)
      .where(eq(schema.creatorUgcPost.creatorUserId, userId))
      .orderBy(desc(schema.creatorUgcPost.postedAt));

    return mapCreatorProfile(saved, statsRow ?? null, ugcRows);
  }

  async upsertBrandProfile(
    userId: string,
    profile: BrandProfileData,
  ): Promise<BrandProfileData> {
    const [saved] = await this.db
      .insert(schema.brandProfile)
      .values({ userId, ...profile })
      .onConflictDoUpdate({
        target: schema.brandProfile.userId,
        set: { ...profile, updatedAt: new Date() },
      })
      .returning();
    return mapBrandProfile(saved);
  }

  async setBrandLogo(
    userId: string,
    image: BrandLogoData,
  ): Promise<BrandProfileData | null> {
    const [saved] = await this.db
      .update(schema.brandProfile)
      .set({
        logoUrl: image.logoUrl,
        logoStorageProvider: image.storageProvider,
        logoStorageKey: image.storageKey,
        logoContentType: image.contentType,
        updatedAt: new Date(),
      })
      .where(eq(schema.brandProfile.userId, userId))
      .returning();

    return saved ? mapBrandProfile(saved) : null;
  }
}

function completeUgcPosts(
  posts: CreatorUgcPostInputDto[] | undefined,
): CreatorUgcPostInputDto[] {
  return (posts ?? [])
    .filter((post) => post.title?.trim() && post.platform?.trim())
    .slice(0, MAX_UGC_POSTS);
}

function postedAtToString(value: string | Date): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function followersFor(
  platforms:
    | Array<{ platform: string; followers: number; source?: string }>
    | null
    | undefined,
  name: string,
): number {
  return (
    platforms?.find((row) => row.platform === name && !isConnectedSource(row.source))
      ?.followers ?? 0
  );
}

function mapCreatorProfile(
  row: typeof schema.creatorProfile.$inferSelect,
  statsRow: typeof schema.creatorDirectoryStats.$inferSelect | null,
  ugcRows: Array<typeof schema.creatorUgcPost.$inferSelect>,
): CreatorProfileData {
  const platforms = Array.isArray(statsRow?.platforms)
    ? statsRow.platforms
    : [];
  return {
    displayName: row.displayName,
    headline: row.headline,
    bio: row.bio,
    location: row.location,
    website: row.website,
    instagram: row.instagram,
    tiktok: row.tiktok,
    youtube: row.youtube,
    niches: row.niches,
    rateRange: row.rateRange,
    turnaround: row.turnaround,
    portfolioUrl: row.portfolioUrl,
    profileImageUrl: row.profileImageUrl,
    followerRange: row.followerRange || '',
    tiktokFollowers: followersFor(platforms, 'TikTok'),
    instagramFollowers: followersFor(platforms, 'Instagram'),
    youtubeFollowers: followersFor(platforms, 'YouTube'),
    avgViews: statsRow?.avgViews ?? 0,
    avgEngagementRate: Number(statsRow?.avgEngagementRate ?? 0),
    ugcPosts: ugcRows
      .filter((post) => !post.source || post.source === 'manual')
      .map((post) => ({
      id: post.id,
      title: post.title,
      platform: post.platform,
      url: post.url ?? '',
      postedAt: postedAtToString(post.postedAt),
      views: post.views,
      likes: post.likes,
      comments: post.comments,
      shares: post.shares,
      saves: post.saves,
      ...(post.campaignName ? { campaignName: post.campaignName } : {}),
      ...(post.brandName ? { brandName: post.brandName } : {}),
    })),
  };
}

function mapBrandProfile(
  row: typeof schema.brandProfile.$inferSelect,
): BrandProfileData {
  return {
    companyName: row.companyName,
    tagline: row.tagline,
    about: row.about,
    website: row.website,
    headquarters: row.headquarters,
    industry: row.industry,
    instagram: row.instagram,
    tiktok: row.tiktok,
    youtube: row.youtube,
    linkedin: row.linkedin,
    companySize: row.companySize,
    typicalBudgetRange: row.typicalBudgetRange,
    primaryGoal: row.primaryGoal,
    preferredCreatorNiches: row.preferredCreatorNiches,
    preferredPlatforms: row.preferredPlatforms,
    logoUrl: row.logoUrl,
  };
}
