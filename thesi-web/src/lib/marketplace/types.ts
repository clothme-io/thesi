export type MarketplaceListingType =
  | "tiktok"
  | "instagram_reels"
  | "youtube_shorts"
  | "ugc_photos"
  | "mixed_bundle"
  | "long_form";

export type PaymentStructure = "flat_rate" | "milestone" | "royalty" | "hybrid";

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
  milestones?: MilestonePayment[];
  royaltyPercent?: number;
  royaltyMinimumCents?: number;
  hybridFlatCents?: number;
  hybridRoyaltyPercent?: number;
  notes?: string;
}

export interface MarketplaceListing {
  id: string;
  name: string;
  brandName: string;
  brandId?: string;
  ownerUserId?: string;
  campaignId?: string;
  type: MarketplaceListingType;
  status: MarketplaceListingStatus;
  startDate: string;
  endDate: string;
  applicationDeadline: string;
  brief: string;
  deliverables: string;
  requirements: string[];
  files: MarketplaceFile[];
  payment: MarketplacePayment;
  location: string;
  remoteOk: boolean;
  slots: number;
  applicantsCount: number;
  postedAt: string;
}

export interface MarketplaceApplication {
  id: string;
  listingId: string;
  pitch: string;
  appliedAt: string;
  addedToCrm: boolean;
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

export const PAYMENT_STRUCTURE_LABELS: Record<PaymentStructure, string> = {
  flat_rate: "Flat Rate",
  milestone: "Milestone",
  royalty: "Royalty",
  hybrid: "Hybrid",
};

export const LISTING_STATUS_LABELS: Record<MarketplaceListingStatus, string> = {
  open: "Open",
  closing_soon: "Closing Soon",
  closed: "Closed",
};

export function formatListingPayment(payment: MarketplacePayment): string {
  switch (payment.structure) {
    case "flat_rate":
      return formatCents(payment.flatAmountCents ?? 0);
    case "milestone": {
      const total = payment.milestones?.reduce((s, m) => s + m.amountCents, 0) ?? 0;
      return `${formatCents(total)} (milestone)`;
    }
    case "royalty":
      return `${payment.royaltyPercent}% royalty${payment.royaltyMinimumCents ? ` · min ${formatCents(payment.royaltyMinimumCents)}` : ""}`;
    case "hybrid":
      return `${formatCents(payment.hybridFlatCents ?? 0)} + ${payment.hybridRoyaltyPercent}%`;
    default:
      return "—";
  }
}

function formatCents(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
