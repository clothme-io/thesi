export interface CreatorUgcPostInput {
  id?: string;
  title: string;
  platform: string;
  url: string;
  postedAt: string;
  views: number;
  likes: number;
  comments?: number;
  shares?: number;
  saves?: number;
  campaignName?: string;
  brandName?: string;
}

export interface CreatorProfile {
  displayName: string;
  headline: string;
  bio: string;
  location: string;
  website: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  niches: string[];
  rateRange: string;
  turnaround: string;
  portfolioUrl: string;
  followerRange: string;
  tiktokFollowers: number;
  instagramFollowers: number;
  youtubeFollowers: number;
  avgViews: number;
  avgEngagementRate: number;
  ugcPosts: CreatorUgcPostInput[];
}

export const DEFAULT_CREATOR_PROFILE: CreatorProfile = {
  displayName: "",
  headline: "UGC Creator",
  bio: "",
  location: "",
  website: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  niches: [],
  rateRange: "",
  turnaround: "3–5 business days",
  portfolioUrl: "",
  followerRange: "",
  tiktokFollowers: 0,
  instagramFollowers: 0,
  youtubeFollowers: 0,
  avgViews: 0,
  avgEngagementRate: 0,
  ugcPosts: [],
};

export const CREATOR_NICHE_OPTIONS = [
  "Fashion",
  "Beauty",
  "Lifestyle",
  "Food",
  "Tech",
  "Fitness",
  "Travel",
];

export const CREATOR_FOLLOWER_RANGE_OPTIONS = [
  { value: "", label: "Select range" },
  { value: "0-500", label: "0 – 500" },
  { value: "500-1k", label: "500 – 1K" },
  { value: "1k-5k", label: "1K – 5K" },
  { value: "5k+", label: "5K+" },
] as const;

export const CREATOR_UGC_PLATFORMS = ["TikTok", "Instagram", "YouTube"] as const;

export const MAX_UGC_POSTS = 12;

export function emptyUgcPost(): CreatorUgcPostInput {
  return {
    id: globalThis.crypto?.randomUUID?.()
      ?? `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    platform: "TikTok",
    url: "",
    postedAt: new Date().toISOString().slice(0, 10),
    views: 0,
    likes: 0,
  };
}
