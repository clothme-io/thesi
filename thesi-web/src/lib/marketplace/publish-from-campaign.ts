import { loadBrandCampaignData } from "@/lib/brand-campaigns/storage";
import type { BrandCampaign } from "@/lib/brand-campaigns/types";
import { addInboxNotification } from "@/lib/inbox/storage";
import { loadBrandProfile } from "@/lib/profile/brand-storage";
import { campaignToListing, mergeMarketplaceListings } from "./listings";
import { loadMarketplaceData, saveMarketplaceData } from "./storage";

export function publishCampaignToMarketplace(
  campaign: BrandCampaign,
  ownerUserId: string,
  brandName?: string,
): void {
  if (!campaign.postToMarketplace || campaign.status !== "active") {
    unpublishCampaignFromMarketplace(campaign.id);
    return;
  }

  const name = brandName ?? (loadBrandProfile().companyName || "Your Brand");
  const listing = campaignToListing(campaign, name, ownerUserId);
  const data = loadMarketplaceData();
  const customListings = [
    ...data.customListings.filter((l) => l.campaignId !== campaign.id),
    listing,
  ];

  saveMarketplaceData({
    ...data,
    customListings,
    listings: mergeMarketplaceListings(customListings),
  });

  addInboxNotification({
    type: "campaign_update",
    title: "Campaign published to marketplace",
    body: `"${campaign.name}" is now live on the marketplace for creators to browse and apply.`,
    href: `/app/marketplace/${listing.id}`,
    campaignId: campaign.id,
    audience: "brand",
  });
}

export function unpublishCampaignFromMarketplace(campaignId: string): void {
  const data = loadMarketplaceData();
  const customListings = data.customListings.filter((l) => l.campaignId !== campaignId);
  saveMarketplaceData({
    ...data,
    customListings,
    listings: mergeMarketplaceListings(customListings),
  });
}

export function syncAllPostedCampaigns(ownerUserId: string, brandName?: string): void {
  const campaigns = loadBrandCampaignData().campaigns.filter(
    (c) => c.postToMarketplace && c.status === "active",
  );
  for (const campaign of campaigns) {
    publishCampaignToMarketplace(campaign, ownerUserId, brandName);
  }
}
