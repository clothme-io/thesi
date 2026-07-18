import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type {
  BrandProfileData,
  CreatorProfileData,
  ProfileRepository,
  ProfileUser,
} from './profile.repository';

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
    return profile ? mapCreatorProfile(profile) : null;
  }

  async getBrandProfile(userId: string): Promise<BrandProfileData | null> {
    const [profile] = await this.db
      .select()
      .from(schema.brandProfile)
      .where(eq(schema.brandProfile.userId, userId))
      .limit(1);
    return profile ? mapBrandProfile(profile) : null;
  }

  async upsertCreatorProfile(
    userId: string,
    profile: CreatorProfileData,
  ): Promise<CreatorProfileData> {
    const platforms = derivePlatforms(profile);
    const [saved] = await this.db
      .insert(schema.creatorProfile)
      .values({
        userId,
        ...profile,
        platforms,
        followerRange: '',
      })
      .onConflictDoUpdate({
        target: schema.creatorProfile.userId,
        set: {
          ...profile,
          platforms,
          updatedAt: new Date(),
        },
      })
      .returning();
    return mapCreatorProfile(saved);
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
}

function mapCreatorProfile(
  row: typeof schema.creatorProfile.$inferSelect,
): CreatorProfileData {
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
  };
}

function derivePlatforms(profile: CreatorProfileData): string[] {
  const platforms: string[] = [];
  if (profile.tiktok?.trim()) platforms.push('TikTok');
  if (profile.instagram?.trim()) platforms.push('Instagram');
  if (profile.youtube?.trim()) platforms.push('YouTube');
  return platforms;
}
