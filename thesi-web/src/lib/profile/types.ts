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
}

export const DEFAULT_PROFILE: CreatorProfile = {
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
};
