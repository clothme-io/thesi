import type { BrandCampaign } from "@/lib/brand-campaigns/types";
import type { MarketplaceListing, MarketplacePayment } from "./types";

function buildRequirements(campaign: BrandCampaign): string[] {
  const reqs: string[] = [];
  if (campaign.requirements.niches.length) reqs.push(...campaign.requirements.niches);
  if (campaign.requirements.minFollowersRange) {
    reqs.push(`${campaign.requirements.minFollowersRange} followers`);
  }
  if (campaign.requirements.platforms.length) reqs.push(...campaign.requirements.platforms);
  if (campaign.requirements.location) reqs.push(campaign.requirements.location);
  return reqs.length ? reqs : ["See campaign brief"];
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
  const deadline = campaign.startDate;
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
    type: campaign.type,
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
    location: campaign.requirements.location || "Remote",
    remoteOk,
    slots: 5,
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

export function getBrowseListingsForCreator(listings: MarketplaceListing[]): MarketplaceListing[] {
  return listings.filter((l) => l.status !== "closed");
}
