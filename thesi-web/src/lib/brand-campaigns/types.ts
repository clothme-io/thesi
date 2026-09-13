import { commissionSummary } from "@/lib/brand-campaigns/commission";
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
export type BrandCampaignPaymentModel = "flat_rate" | "milestone" | "royalty" | "hybrid" | "commission";
export type BrandCampaignMilestoneStructure =
  | "cumulative"
  | "highest_achieved";
export type BrandCampaignHybridBaseTrigger =
  | "campaign_accepted"
  | "contract_signed"
  | "content_submitted"
  | "content_accepted"
  | "content_published"
  | "campaign_completed"
  | "custom";
export type BrandCampaignHybridMetric =
  | "views"
  | "qualified_signups"
  | "account_creations"
  | "fit_profiles_completed"
  | "purchases"
  | "sales_revenue"
  | "engagement"
  | "clicks"
  | "custom";
export type BrandCampaignHybridMilestoneAmountType =
  | "total_compensation"
  | "bonus_in_addition_to_base";
export type BrandCampaignHybridAffiliateType =
  | "percentage_of_sale"
  | "percentage_of_platform_commission"
  | "fixed_amount_per_sale";
export type BrandCampaignHybridPoolDistribution =
  | "impact_score"
  | "proportional_performance"
  | "equal_distribution"
  | "manual"
  | "custom";
export type BrandCampaignHybridPoolSettlement =
  | "campaign_end"
  | "days_after_campaign_end"
  | "manual";

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

export interface BrandCampaignHybridPayment {
  base?: {
    enabled: boolean;
    amountCents?: number;
    currency: "USD";
    trigger: BrandCampaignHybridBaseTrigger;
    customTrigger?: string;
  };
  milestones?: {
    enabled: boolean;
    metric: BrandCampaignHybridMetric;
    customMetric?: string;
    payoutMethod: BrandCampaignMilestoneStructure;
    amountType: BrandCampaignHybridMilestoneAmountType;
    tiers: BrandCampaignMilestone[];
  };
  affiliate?: {
    enabled: boolean;
    commissionType: BrandCampaignHybridAffiliateType;
    commissionPercent?: number;
    fixedAmountCents?: number;
    currency: "USD";
    attributionWindowDays?: number;
    terms?: string;
  };
  creatorPool?: {
    enabled: boolean;
    poolAmountCents?: number;
    currency: "USD";
    campaignGoal?: string;
    distributionMethod: BrandCampaignHybridPoolDistribution;
    customDistributionMethod?: string;
    metrics: Array<{
      id: string;
      name: string;
      weightPercent: number;
    }>;
    settlementType: BrandCampaignHybridPoolSettlement;
    settlementDays?: number;
    rules?: string;
  };
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
    hybrid?: BrandCampaignHybridPayment;
    notes?: string;
  };
  requiredTasks: BrandCampaignRequiredTask[];
  creatorBenefits: BrandCampaignCreatorBenefits;
  contentRights?: BrandCampaignContentRights;
  productsProvided: BrandCampaignProductProvided[];
  creatorCapacity?: number;
  creatorDisclosureEnabled?: boolean;
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
  commission: "Base + Commission",
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
    case "commission":
      return commissionSummary(payment.hybrid);
    case "hybrid": {
      const base = payment.hybrid?.base?.enabled
        ? payment.hybrid.base.amountCents ?? 0
        : payment.flatRateCents ?? 0;
      const milestoneAmounts = payment.hybrid?.milestones?.enabled
        ? payment.hybrid.milestones.tiers.map((m) => m.amountCents)
        : [];
      const milestoneTotal =
        payment.hybrid?.milestones?.payoutMethod === "cumulative"
          ? milestoneAmounts.reduce((sum, amount) => sum + amount, 0)
          : Math.max(0, ...milestoneAmounts);
      const pool = payment.hybrid?.creatorPool?.enabled
        ? payment.hybrid.creatorPool.poolAmountCents ?? 0
        : 0;
      const parts = [formatMoney(base)];
      if (milestoneTotal > 0) parts.push(`${formatMoney(milestoneTotal)} performance`);
      if (payment.hybrid?.affiliate?.enabled) parts.push("affiliate");
      if (pool > 0) parts.push(`${formatMoney(pool)} pool`);
      return parts.join(" + ");
    }
    default:
      return "—";
  }
}
