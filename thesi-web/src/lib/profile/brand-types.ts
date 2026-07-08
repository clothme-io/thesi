export interface BrandProfile {
  companyName: string;
  tagline: string;
  about: string;
  website: string;
  headquarters: string;
  industry: string;
  instagram: string;
  tiktok: string;
  youtube: string;
  linkedin: string;
  companySize: string;
  typicalBudgetRange: string;
  primaryGoal: string;
  preferredCreatorNiches: string[];
  preferredPlatforms: string[];
}

export const DEFAULT_BRAND_PROFILE: BrandProfile = {
  companyName: "",
  tagline: "Fashion & lifestyle brand",
  about: "",
  website: "",
  headquarters: "",
  industry: "",
  instagram: "",
  tiktok: "",
  youtube: "",
  linkedin: "",
  companySize: "",
  typicalBudgetRange: "",
  primaryGoal: "",
  preferredCreatorNiches: [],
  preferredPlatforms: [],
};

export const BRAND_INDUSTRY_OPTIONS = [
  "Fashion",
  "Beauty",
  "Lifestyle",
  "Food & Beverage",
  "Tech",
  "Fitness",
  "Other",
];

export const BRAND_NICHE_OPTIONS = [
  "Fashion",
  "Beauty",
  "Lifestyle",
  "Food",
  "Tech",
  "Fitness",
  "Travel",
];

export const BRAND_PLATFORM_OPTIONS = [
  "TikTok",
  "Instagram",
  "YouTube",
  "Pinterest",
  "Snapchat",
];

export const BRAND_BUDGET_OPTIONS = ["<$1k", "$1k–$5k", "$5k–$15k", "$15k+"];

export const BRAND_COMPANY_SIZE_OPTIONS = ["1", "2–5", "6–20", "21–50", "51+"];

export const BRAND_GOAL_OPTIONS = [
  "Find creators",
  "Manage campaigns",
  "Track payments",
  "All of the above",
];
