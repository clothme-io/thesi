import type { CreatorCrmData } from "@/lib/creator-crm/types";
import type { MarketplaceListing } from "./types";
import { formatListingPayment } from "./types";

function listingValueCents(listing: MarketplaceListing): number {
  const { payment } = listing;
  switch (payment.structure) {
    case "flat_rate":
      return payment.flatAmountCents ?? 0;
    case "milestone":
      return payment.milestones?.reduce((sum, m) => sum + m.amountCents, 0) ?? 0;
    case "royalty":
      return payment.royaltyMinimumCents ?? 0;
    case "hybrid":
      return payment.hybridFlatCents ?? 0;
    default:
      return 0;
  }
}

export function addListingToCrm(
  data: CreatorCrmData,
  listing: MarketplaceListing,
): CreatorCrmData {
  const now = new Date().toISOString();
  let brandId = listing.brandId;

  if (!brandId || !data.brands.some((b) => b.id === brandId)) {
    brandId = `brand-mp-${listing.id}`;
    const brandExists = data.brands.some((b) => b.id === brandId);
    if (!brandExists) {
      data = {
        ...data,
        brands: [
          ...data.brands,
          {
            id: brandId,
            name: listing.brandName,
            contactName: "Hiring team",
            email: "",
            phone: "",
            website: "",
            relationshipStage: "prospect",
            tags: ["Marketplace"],
            notes: `Added from marketplace listing: ${listing.name}`,
            createdAt: now,
            updatedAt: now,
          },
        ],
      };
    }
  }

  const dealId = `deal-mp-${listing.id}`;
  const dealExists = data.deals.some((d) => d.id === dealId);
  if (dealExists) return data;

  const valueCents = listingValueCents(listing);
  const dealNotes = [
    `Source: Marketplace — ${listing.name}`,
    `Type: ${listing.type}`,
    `Payment: ${formatListingPayment(listing.payment)}`,
    listing.brief.slice(0, 200),
  ].join("\n");

  return {
    ...data,
    deals: [
      ...data.deals,
      {
        id: dealId,
        brandId,
        title: listing.name,
        valueCents,
        stage: "lead",
        expectedCloseDate: listing.applicationDeadline,
        notes: dealNotes,
        createdAt: now,
        updatedAt: now,
      },
    ],
    activities: [
      {
        id: `act-mp-${Date.now()}`,
        brandId,
        dealId,
        type: "deal_moved",
        message: `Added marketplace listing "${listing.name}" to pipeline`,
        createdAt: now,
      },
      ...data.activities,
    ],
  };
}
