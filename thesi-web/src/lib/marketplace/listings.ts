import type { BrandCampaign } from "@/lib/brand-campaigns/types";
import { buildLabeledRequirements } from "./requirements";
import {
  EMPTY_LISTING_CONTENT_RIGHTS,
  type MarketplaceListing,
  type MarketplaceListingStatus,
  type MarketplacePayment,
} from "./types";

function buildRequirements(campaign: BrandCampaign): string[] {
  return buildLabeledRequirements(campaign.requirements);
}

function campaignPaymentToListingPayment(campaign: BrandCampaign): MarketplacePayment {
  const payment = campaign.payment;
  switch (payment.model) {
    case "flat_rate":
      return { structure: "flat_rate", currency: "USD", flatAmountCents: payment.flatRateCents ?? 0, notes: payment.notes };
    case "milestone":
      return {
        structure: "milestone",
        currency: "USD",
        milestones: payment.milestones?.map((m) => ({
          label: m.label,
          amountCents: m.amountCents,
          trigger: m.trigger,
        })),
        notes: payment.notes,
      };
    case "royalty":
      return { structure: "royalty", currency: "USD", royaltyPercent: payment.royaltyPercent ?? 0, notes: payment.notes };
    case "hybrid":
      return {
        structure: "hybrid",
        currency: "USD",
        hybridFlatCents: payment.flatRateCents ?? 0,
        hybridRoyaltyPercent: payment.royaltyPercent ?? 0,
        notes: payment.notes,
      };
    default:
      return { structure: "flat_rate", currency: "USD", flatAmountCents: 0 };
  }
}

/** Client-side preview helper — server sync owns persisted listings. */
export function campaignToListing(
  campaign: BrandCampaign,
  brandName: string,
  ownerUserId: string,
): MarketplaceListing {
  const deadline = campaign.endDate;
  const remoteOk =
    !campaign.requirements.location ||
    campaign.requirements.location.toLowerCase() === "remote" ||
    campaign.requirements.location.toLowerCase() === "us";

  return {
    id: campaign.id,
    campaignId: campaign.id,
    ownerUserId,
    name: campaign.name,
    brandName,
    campaignType: campaign.campaignType,
    contentTypes: campaign.contentTypes,
    status: campaign.status === "active" ? "open" : campaign.status === "completed" ? "closed" : "closing_soon",
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    applicationDeadline: deadline,
    brief: campaign.brief,
    deliverables: campaign.deliverables,
    exampleVideoLinks: campaign.exampleVideoLinks ?? [],
    requirements: buildRequirements(campaign),
    files: campaign.files.map((f) => ({ id: f.id, name: f.name, sizeLabel: f.sizeLabel })),
    payment: campaignPaymentToListingPayment(campaign),
    requiredTasks: campaign.requiredTasks,
    creatorBenefits: campaign.creatorBenefits,
    contentRights: campaign.contentRights ?? EMPTY_LISTING_CONTENT_RIGHTS,
    productsProvided: campaign.productsProvided,
    location: campaign.requirements.location || "Remote",
    remoteOk,
    slots: campaign.creatorCapacity ?? 5,
    applicantsCount: 0,
    postedAt: new Date().toISOString(),
  };
}

export function getListingsForBrand(
  listings: MarketplaceListing[],
  ownerUserId: string,
): MarketplaceListing[] {
  return listings.filter((l) => l.ownerUserId === ownerUserId);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function isPastApplicationDeadline(
  listing: Pick<MarketplaceListing, "applicationDeadline">,
  today = todayIso(),
) {
  return Boolean(listing.applicationDeadline && listing.applicationDeadline < today);
}

export function getEffectiveListingStatus(
  listing: Pick<MarketplaceListing, "applicationDeadline" | "status">,
  today = todayIso(),
): MarketplaceListingStatus {
  if (listing.status === "closed" || isPastApplicationDeadline(listing, today)) {
    return "closed";
  }
  return listing.status;
}

export function canCreatorApplyToListing(
  listing: Pick<MarketplaceListing, "applicationDeadline" | "status">,
  today = todayIso(),
) {
  return getEffectiveListingStatus(listing, today) !== "closed";
}

export function getBrowseListingsForCreator(listings: MarketplaceListing[]): MarketplaceListing[] {
  return listings.filter((listing) => canCreatorApplyToListing(listing));
}
