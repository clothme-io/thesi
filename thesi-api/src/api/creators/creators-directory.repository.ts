export const CREATORS_DIRECTORY_REPOSITORY = Symbol(
  'CREATORS_DIRECTORY_REPOSITORY',
);

export type DirectoryUser = {
  id: string;
  role: string;
};

export type CreatorPlatformStats = {
  platform: string;
  followers: number;
  avgViews: number;
  engagementRate: number;
};

export type CreatorUgcPost = {
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
};

export type CreatorDirectoryProfile = {
  id: string;
  name: string;
  email: string;
  niches: string[];
  location: string;
  platforms: string[];
  followerRange: string;
  bio: string;
  stats: {
    totalFollowers: number;
    avgViews: number;
    avgEngagementRate: number;
    completedCampaigns: number;
    responseRate: number;
    platforms: CreatorPlatformStats[];
  };
  ugcPosts: CreatorUgcPost[];
};

export interface CreatorsDirectoryRepository {
  getUser(userId: string): Promise<DirectoryUser | null>;
  listCreators(): Promise<CreatorDirectoryProfile[]>;
  getCreator(creatorUserId: string): Promise<CreatorDirectoryProfile | null>;
  listFavoriteIds(brandUserId: string): Promise<string[]>;
  addFavorite(brandUserId: string, creatorUserId: string): Promise<void>;
  removeFavorite(brandUserId: string, creatorUserId: string): Promise<void>;
  creatorExists(creatorUserId: string): Promise<boolean>;
}
