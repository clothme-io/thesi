import type { BrandCampaignGoalType } from "@/lib/brand-campaigns/types";
import type { BrandCampaignHybridPayment } from "@/lib/brand-campaigns/types";

export type MarketplaceListingType =
  | "tiktok"
  | "instagram_reels"
  | "youtube_shorts"
  | "ugc_photos"
  | "mixed_bundle"
  | "long_form";

export type PaymentStructure = "flat_rate" | "milestone" | "royalty" | "hybrid";
export type MilestoneStructure = "cumulative" | "highest_achieved";

export type MarketplaceListingStatus = "open" | "closing_soon" | "closed";

export interface MarketplaceFile {
  id: string;
  name: string;
  sizeLabel: string;
}

export interface MilestonePayment {
  label: string;
  amountCents: number;
  trigger: string;
}

export interface MarketplacePayment {
  structure: PaymentStructure;
  currency: "USD";
  flatAmountCents?: number;
  milestoneStructure?: MilestoneStructure;
  milestones?: MilestonePayment[];
  royaltyPercent?: number;
  royaltyMinimumCents?: number;
  hybridFlatCents?: number;
  hybridRoyaltyPercent?: number;
  hybrid?: BrandCampaignHybridPayment;
  notes?: string;
}

export interface MarketplaceListing {
  id: string;
  name: string;
  brandName: string;
  brandId?: string;
  ownerUserId?: string;
  campaignId?: string;
  campaignType: BrandCampaignGoalType;
  contentTypes: MarketplaceListingType[];
  status: MarketplaceListingStatus;
  startDate: string;
  endDate: string;
  applicationDeadline: string;
  brief: string;
  deliverables: string;
  exampleVideoLinks: string[];
  requirements: string[];
  files: MarketplaceFile[];
  payment: MarketplacePayment;
  requiredTasks: Array<{
    id: string;
    title: string;
    description?: string;
    required: boolean;
  }>;
  creatorBenefits: {
    guaranteedPaymentCents?: number;
    productsKept: boolean;
    bonusEligibility: boolean;
    creatorPoolEligibility: boolean;
    foundingCreatorRecognition: boolean;
    portfolioUse: boolean;
    priorityFutureCampaigns: boolean;
    brandOpportunityAccess: boolean;
    customBenefits: string[];
  };
  contentRights?: {
    organicUsage: boolean;
    websiteAppUsage: boolean;
    paidAdsUsage: boolean;
    duration: string;
    rawContentAccess: boolean;
  };
  productsProvided: Array<{
    id: string;
    name: string;
    quantity?: number;
    creatorKeeps: boolean;
  }>;
  creatorDisclosureEnabled?: boolean;
  location: string;
  remoteOk: boolean;
  slots: number;
  totalSlots?: number;
  acceptedCreatorsCount?: number;
  slotsLeft?: number;
  applicantsCount: number;
  postedAt: string;
}

export type MarketplaceApplicationStatus = "pending" | "accepted" | "rejected";

export interface MarketplaceApplication {
  id: string;
  listingId: string;
  pitch: string;
  appliedAt: string;
  addedToCrm: boolean;
  status: MarketplaceApplicationStatus;
}

export interface MarketplaceBrandApplication extends MarketplaceApplication {
  creatorUserId: string;
  creatorName: string;
  creatorEmail: string;
}

export interface MarketplaceData {
  customListings: MarketplaceListing[];
  applications: MarketplaceApplication[];
  crmLinkedListingIds: string[];
  /** Merged seed + custom — computed on load, not persisted separately. */
  listings: MarketplaceListing[];
}

export const LISTING_TYPE_LABELS: Record<MarketplaceListingType, string> = {
  tiktok: "TikTok",
  instagram_reels: "Instagram Reels",
  youtube_shorts: "YouTube Shorts",
  ugc_photos: "UGC Photos",
  mixed_bundle: "Mixed Bundle",
  long_form: "Long Form",
};

export function formatListingContentTypes(
  contentTypes: MarketplaceListingType[] = [],
): string {
  if (!Array.isArray(contentTypes) || contentTypes.length === 0) return "—";
  return contentTypes
    .map((type) => LISTING_TYPE_LABELS[type])
    .filter(Boolean)
    .join(", ");
}

export const PAYMENT_STRUCTURE_LABELS: Record<PaymentStructure, string> = {
  flat_rate: "Flat Rate",
  milestone: "Milestone",
  royalty: "Royalty",
  hybrid: "Hybrid",
};

export const EMPTY_LISTING_CREATOR_BENEFITS: MarketplaceListing["creatorBenefits"] = {
  productsKept: false,
  bonusEligibility: false,
  creatorPoolEligibility: false,
  foundingCreatorRecognition: false,
  portfolioUse: false,
  priorityFutureCampaigns: false,
  brandOpportunityAccess: false,
  customBenefits: [],
};

export const EMPTY_LISTING_CONTENT_RIGHTS: NonNullable<MarketplaceListing["contentRights"]> = {
  organicUsage: true,
  websiteAppUsage: false,
  paidAdsUsage: false,
  duration: "",
  rawContentAccess: false,
};

export function normalizeMarketplaceListing(listing: MarketplaceListing): MarketplaceListing {
  const creatorBenefits = listing.creatorBenefits ?? EMPTY_LISTING_CREATOR_BENEFITS;

  return {
    ...listing,
    contentTypes: Array.isArray(listing.contentTypes) ? listing.contentTypes : [],
    exampleVideoLinks: Array.isArray(listing.exampleVideoLinks)
      ? listing.exampleVideoLinks
      : [],
    requirements: Array.isArray(listing.requirements) ? listing.requirements : [],
    files: Array.isArray(listing.files) ? listing.files : [],
    payment: listing.payment ?? {
      structure: "flat_rate",
      currency: "USD",
      flatAmountCents: 0,
    },
    requiredTasks: Array.isArray(listing.requiredTasks) ? listing.requiredTasks : [],
    creatorBenefits: {
      ...EMPTY_LISTING_CREATOR_BENEFITS,
      ...creatorBenefits,
      customBenefits: Array.isArray(creatorBenefits.customBenefits)
        ? creatorBenefits.customBenefits
        : [],
    },
    contentRights: {
      ...EMPTY_LISTING_CONTENT_RIGHTS,
      ...(listing.contentRights ?? {}),
    },
    productsProvided: Array.isArray(listing.productsProvided)
      ? listing.productsProvided
      : [],
    creatorDisclosureEnabled: listing.creatorDisclosureEnabled ?? false,
    totalSlots: listing.totalSlots ?? listing.slots,
    acceptedCreatorsCount: listing.acceptedCreatorsCount ?? 0,
    slotsLeft:
      listing.slotsLeft ??
      Math.max((listing.totalSlots ?? listing.slots) - (listing.acceptedCreatorsCount ?? 0), 0),
  };
}

export const LISTING_STATUS_LABELS: Record<MarketplaceListingStatus, string> = {
  open: "Open",
  closing_soon: "Closing Soon",
  closed: "Closed",
};

export const APPLICATION_STATUS_LABELS: Record<MarketplaceApplicationStatus, string> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Rejected",
};

export function formatListingPayment(payment: MarketplacePayment): string {
  if (!payment) return "—";

  switch (payment.structure) {
    case "flat_rate":
      return formatCents(payment.flatAmountCents ?? 0);
    case "milestone": {
      const amounts = payment.milestones?.map((m) => m.amountCents) ?? [];
      const total =
        payment.milestoneStructure === "cumulative"
          ? amounts.reduce((s, amount) => s + amount, 0)
          : Math.max(0, ...amounts);
      return `${formatCents(total)} (milestone)`;
    }
    case "royalty":
      return `${payment.royaltyPercent}% royalty${payment.royaltyMinimumCents ? ` · min ${formatCents(payment.royaltyMinimumCents)}` : ""}`;
    case "hybrid":
      return formatHybridPaymentSummary(payment);
    default:
      return "—";
  }
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function formatHybridPaymentSummary(payment: MarketplacePayment): string {
  const hybrid = payment.hybrid;
  if (!hybrid) {
    return `${formatCents(payment.hybridFlatCents ?? 0)} + ${payment.hybridRoyaltyPercent ?? 0}%`;
  }
  const parts: string[] = [];
  if (hybrid.base?.enabled) {
    parts.push(formatCents(hybrid.base.amountCents ?? 0));
  }
  if (hybrid.milestones?.enabled && hybrid.milestones.tiers.length > 0) {
    const amounts = hybrid.milestones.tiers.map((tier) => tier.amountCents);
    const total =
      hybrid.milestones.payoutMethod === "cumulative"
        ? amounts.reduce((sum, amount) => sum + amount, 0)
        : Math.max(0, ...amounts);
    parts.push(`${formatCents(total)} performance`);
  }
  if (hybrid.affiliate?.enabled) parts.push("affiliate");
  if (hybrid.creatorPool?.enabled && (hybrid.creatorPool.poolAmountCents ?? 0) > 0) {
    parts.push(`${formatCents(hybrid.creatorPool.poolAmountCents ?? 0)} pool`);
  }
  return parts.length > 0 ? parts.join(" + ") : "Hybrid";
}
