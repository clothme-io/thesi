export const CREATOR_FOLLOWER_RANGES = [
  '0-500',
  '500-1k',
  '1k-5k',
  '5k+',
] as const;

export type CreatorFollowerRange = (typeof CREATOR_FOLLOWER_RANGES)[number];

const APPLICATION_RANGE_MAP: Record<string, CreatorFollowerRange> = {
  '0-500': '0-500',
  '500-1K': '500-1k',
  '500-1k': '500-1k',
  '1K-5K': '1k-5k',
  '1k-5k': '1k-5k',
  '5K+': '5k+',
  '5k+': '5k+',
};

export function mapApplicationFollowerRange(raw: string): string {
  const key = raw.trim();
  if (!key) return '';
  return APPLICATION_RANGE_MAP[key] ?? APPLICATION_RANGE_MAP[key.toLowerCase()] ?? '';
}

export function derivePlatformsFromSocials(input: {
  tiktok?: string;
  instagram?: string;
  youtube?: string;
}): string[] {
  const platforms: string[] = [];
  if (input.tiktok?.trim()) platforms.push('TikTok');
  if (input.instagram?.trim()) platforms.push('Instagram');
  if (input.youtube?.trim()) platforms.push('YouTube');
  return platforms;
}

export type SelfReportedPlatformStats = {
  platform: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
};

export function buildSelfReportedStats(input: {
  tiktok?: string;
  instagram?: string;
  youtube?: string;
  tiktokFollowers: number;
  instagramFollowers: number;
  youtubeFollowers: number;
  avgViews: number;
  avgEngagementRate: number;
}): {
  totalFollowers: number;
  avgViews: number;
  avgEngagementRate: number;
  platforms: SelfReportedPlatformStats[];
} {
  const platforms: SelfReportedPlatformStats[] = [];
  const push = (
    platform: string,
    handle: string | undefined,
    followers: number,
  ) => {
    if (!handle?.trim() && followers <= 0) return;
    platforms.push({
      platform,
      followers,
      avgViews: 0,
      engagementRate: 0,
    });
  };

  push('TikTok', input.tiktok, input.tiktokFollowers);
  push('Instagram', input.instagram, input.instagramFollowers);
  push('YouTube', input.youtube, input.youtubeFollowers);

  return {
    totalFollowers: platforms.reduce((sum, row) => sum + row.followers, 0),
    avgViews: input.avgViews,
    avgEngagementRate: input.avgEngagementRate,
    platforms,
  };
}

export function nativeStatsFromInvites(
  statuses: Array<'sent' | 'accepted' | 'declined' | string>,
): { completedCampaigns: number; responseRate: number } {
  const received = statuses.length;
  const accepted = statuses.filter((status) => status === 'accepted').length;
  const declined = statuses.filter((status) => status === 'declined').length;
  return {
    completedCampaigns: accepted,
    responseRate:
      received === 0
        ? 0
        : Math.round(((accepted + declined) / received) * 100),
  };
}

export function averageUgcViews(
  posts: Array<{ views: number }>,
): number {
  const counted = posts.filter((post) => post.views > 0);
  if (counted.length === 0) return 0;
  return Math.round(
    counted.reduce((sum, post) => sum + post.views, 0) / counted.length,
  );
}

export function creatorProfileSeedFromApplication(application: {
  fullName: string;
  city: string;
  country: string;
  tiktokUrl: string;
  instagramUrl: string;
  youtubeUrl?: string | null;
  followerCountRange: string;
  portfolioLink: string;
}): {
  displayName: string;
  location: string;
  tiktok: string;
  instagram: string;
  youtube: string;
  followerRange: string;
  portfolioUrl: string;
  platforms: string[];
} {
  const tiktok = application.tiktokUrl.trim();
  const instagram = application.instagramUrl.trim();
  const youtube = application.youtubeUrl?.trim() ?? '';
  return {
    displayName: application.fullName.trim(),
    location: [application.city.trim(), application.country.trim()]
      .filter(Boolean)
      .join(', '),
    tiktok,
    instagram,
    youtube,
    followerRange: mapApplicationFollowerRange(application.followerCountRange),
    portfolioUrl: application.portfolioLink.trim(),
    platforms: derivePlatformsFromSocials({ tiktok, instagram, youtube }),
  };
}
