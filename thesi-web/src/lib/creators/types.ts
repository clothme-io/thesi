export interface CreatorPlatformStats {
  platform: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
}

export interface CreatorStats {
  totalFollowers: number;
  avgViews: number;
  avgEngagementRate: number;
  completedCampaigns: number;
  responseRate: number;
  platforms: CreatorPlatformStats[];
}

export interface CreatorUgcPost {
  id: string;
  creatorId: string;
  title: string;
  platform: string;
  campaignName?: string;
  brandName?: string;
  postedAt: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  saves: number;
}

export interface CreatorProfile {
  id: string;
  name: string;
  email: string;
  niches: string[];
  location: string;
  platforms: string[];
  followerRange: string;
  bio: string;
  stats: CreatorStats;
  ugcPosts: CreatorUgcPost[];
}

/** Backward-compatible alias for invite matching. */
export type CreatorDirectoryEntry = Pick<
  CreatorProfile,
  "id" | "name" | "email" | "niches" | "location" | "platforms" | "followerRange"
>;

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}

export function formatPercent(rate: number): string {
  return `${rate.toFixed(1)}%`;
}
