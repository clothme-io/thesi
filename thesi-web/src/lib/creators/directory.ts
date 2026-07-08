export interface CreatorDirectoryEntry {
  id: string;
  name: string;
  email: string;
  niches: string[];
  location: string;
  platforms: string[];
  followerRange: string;
}

/** Seed creators on Thesi for invite matching (v1). */
export const CREATOR_DIRECTORY: CreatorDirectoryEntry[] = [
  {
    id: "creator-1",
    name: "Alex Rivera",
    email: "alex@creator.dev",
    niches: ["Fitness", "Lifestyle"],
    location: "US",
    platforms: ["TikTok", "Instagram"],
    followerRange: "10k+",
  },
  {
    id: "creator-2",
    name: "Sam Chen",
    email: "sam@creator.dev",
    niches: ["Fashion", "Lifestyle"],
    location: "Los Angeles",
    platforms: ["Instagram"],
    followerRange: "5k+",
  },
  {
    id: "creator-3",
    name: "Jordan Lee",
    email: "jordan.lee@nike.com",
    niches: ["Fitness", "Sportswear"],
    location: "US",
    platforms: ["TikTok", "YouTube"],
    followerRange: "50k+",
  },
  {
    id: "creator-4",
    name: "Priya Shah",
    email: "priya@glowtheory.com",
    niches: ["Beauty", "Skincare"],
    location: "Remote",
    platforms: ["TikTok", "Instagram"],
    followerRange: "8k+",
  },
  {
    id: "creator-5",
    name: "Maya Ortiz",
    email: "maya@lunaboutique.co",
    niches: ["Fashion"],
    location: "Los Angeles",
    platforms: ["Instagram"],
    followerRange: "3k+",
  },
  {
    id: "creator-6",
    name: "Chris Nguyen",
    email: "chris@harborhearth.com",
    niches: ["Food", "Lifestyle"],
    location: "Seattle",
    platforms: ["TikTok"],
    followerRange: "2k+",
  },
];
