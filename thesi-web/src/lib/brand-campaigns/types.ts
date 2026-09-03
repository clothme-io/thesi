export type BrandCampaignGoalType =
  | "experience"
  | "growth"
  | "product"
  | "brand_partnership"
  | "community";

export type BrandCampaignType =
  | "tiktok"
  | "instagram_reels"
  | "youtube_shorts"
  | "ugc_photos"
  | "mixed_bundle"
  | "long_form";

export type BrandCampaignStatus = "draft" | "active" | "paused" | "completed";
export type BrandCampaignPaymentModel = "flat_rate" | "milestone" | "royalty" | "hybrid";
export type BrandCampaignMilestoneStructure =
  | "cumulative"
  | "highest_achieved";

export interface BrandCampaignFile {
  id: string;
  name: string;
  sizeLabel: string;
}

export interface BrandCampaignMilestone {
  id: string;
  label: string;
  trigger: string;
  amountCents: number;
}

export interface BrandCampaignRequiredTask {
  id: string;
  title: string;
  description?: string;
  required: boolean;
}

export interface BrandCampaignCreatorBenefits {
  guaranteedPaymentCents?: number;
  productsKept: boolean;
  bonusEligibility: boolean;
  creatorPoolEligibility: boolean;
  foundingCreatorRecognition: boolean;
  portfolioUse: boolean;
  priorityFutureCampaigns: boolean;
  brandOpportunityAccess: boolean;
  customBenefits: string[];
}

export interface BrandCampaignContentRights {
  organicUsage: boolean;
  websiteAppUsage: boolean;
  paidAdsUsage: boolean;
  duration: string;
  rawContentAccess: boolean;
}

export interface BrandCampaignProductProvided {
  id: string;
  name: string;
  quantity?: number;
  creatorKeeps: boolean;
}

export interface BrandCampaign {
  id: string;
  name: string;
  campaignType: BrandCampaignGoalType;
  contentTypes: BrandCampaignType[];
  status: BrandCampaignStatus;
  startDate: string;
  endDate: string;
  brief: string;
  deliverables: string;
  exampleVideoLinks: string[];
  requirements: {
    niches: string[];
    minFollowersRange: string;
    location: string;
    platforms: string[];
  };
  files: BrandCampaignFile[];
  payment: {
    model: BrandCampaignPaymentModel;
    flatRateCents?: number;
    milestoneStructure?: BrandCampaignMilestoneStructure;
    milestones?: BrandCampaignMilestone[];
    royaltyPercent?: number;
    notes?: string;
  };
  requiredTasks: BrandCampaignRequiredTask[];
  creatorBenefits: BrandCampaignCreatorBenefits;
  contentRights?: BrandCampaignContentRights;
  productsProvided: BrandCampaignProductProvided[];
  creatorCapacity?: number;
  postToMarketplace: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BrandCampaignData {
  campaigns: BrandCampaign[];
}

export const BRAND_CAMPAIGN_GOAL_TYPE_LABELS: Record<BrandCampaignGoalType, string> = {
  experience: "Experience Campaigns",
  growth: "Growth Campaigns",
  product: "Product Campaigns",
  brand_partnership: "Brand Partnership Campaigns",
  community: "Community Campaigns",
};

export const BRAND_CAMPAIGN_GOAL_TYPE_PURPOSES: Record<BrandCampaignGoalType, string> = {
  experience: "Creators test products or features before promoting them.",
  growth: "Grow the business or app or platform.",
  product: "Help brands sell products.",
  brand_partnership: "Help brands achieve specific business goals.",
  community: "Strengthen the community.",
};

/** Content format labels (applies to all campaign types). */
export const BRAND_CAMPAIGN_TYPE_LABELS: Record<BrandCampaignType, string> = {
  tiktok: "TikTok",
  instagram_reels: "Instagram Reels",
  youtube_shorts: "YouTube Shorts",
  ugc_photos: "UGC Photos",
  mixed_bundle: "Mixed Bundle",
  long_form: "Long Form",
};

export function getCampaignContentTypesLabel(
  contentTypes: BrandCampaignType[],
): string {
  if (contentTypes.length === 0) return "—";
  return contentTypes
    .map((type) => BRAND_CAMPAIGN_TYPE_LABELS[type])
    .filter(Boolean)
    .join(", ");
}

export const BRAND_CAMPAIGN_STATUS_LABELS: Record<BrandCampaignStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

export const BRAND_CAMPAIGN_PAYMENT_LABELS: Record<BrandCampaignPaymentModel, string> = {
  flat_rate: "Flat Rate",
  milestone: "Milestone",
  royalty: "Royalty",
  hybrid: "Hybrid",
};

export const EMPTY_CREATOR_BENEFITS: BrandCampaignCreatorBenefits = {
  productsKept: false,
  bonusEligibility: false,
  creatorPoolEligibility: false,
  foundingCreatorRecognition: false,
  portfolioUse: false,
  priorityFutureCampaigns: false,
  brandOpportunityAccess: false,
  customBenefits: [],
};

export const EMPTY_CONTENT_RIGHTS: BrandCampaignContentRights = {
  organicUsage: true,
  websiteAppUsage: false,
  paidAdsUsage: false,
  duration: "",
  rawContentAccess: false,
};

export function formatMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

export function getCampaignBudgetLabel(campaign: BrandCampaign): string {
  const payment = campaign.payment;
  switch (payment.model) {
    case "flat_rate":
      return formatMoney(payment.flatRateCents ?? 0);
    case "milestone": {
      const amounts = payment.milestones?.map((m) => m.amountCents) ?? [];
      const total =
        payment.milestoneStructure === "cumulative"
          ? amounts.reduce((sum, amount) => sum + amount, 0)
          : Math.max(0, ...amounts);
      return `${formatMoney(total)} (milestones)`;
    }
    case "royalty":
      return `${payment.royaltyPercent ?? 0}% royalty`;
    case "hybrid": {
      const flat = formatMoney(payment.flatRateCents ?? 0);
      return `${flat} + ${payment.royaltyPercent ?? 0}%`;
    }
    default:
      return "—";
  }
}
