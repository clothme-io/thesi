export interface CreatorPlatformStats {
  platform: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
  source?: "self_reported" | "youtube" | "tiktok" | "instagram";
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
  url?: string;
  source?: string;
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
  statsSyncedAt?: string | null;
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

export function formatFollowers(
  totalFollowers: number,
  followerRange?: string,
): string {
  if (totalFollowers > 0) return formatCount(totalFollowers);
  const range = followerRange?.trim();
  return range || "—";
}

export function formatStatCount(n: number): string {
  return n > 0 ? formatCount(n) : "—";
}

export function formatPercent(rate: number): string {
  return `${rate.toFixed(1)}%`;
}

export function formatStatPercent(rate: number): string {
  return rate > 0 ? formatPercent(rate) : "—";
}

export function isConnectedPlatformSource(source?: string | null): boolean {
  return source === "youtube" || source === "tiktok" || source === "instagram";
}

export function hasConnectedStats(stats: CreatorStats): boolean {
  return stats.platforms.some((platform) =>
    isConnectedPlatformSource(platform.source),
  );
}

export function formatSyncedAgo(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  const minutes = Math.max(0, Math.round((Date.now() - then) / 60_000));
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) return `Updated ${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Updated ${hours}h ago`;
  const days = Math.round(hours / 24);
  return `Updated ${days}d ago`;
}
