import type { BrandCampaign } from "@/lib/brand-campaigns/types";
import { addInboxNotification } from "@/lib/inbox/storage";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

/**
 * Marketplace listings are synced by thesi-api when campaigns are created/updated.
 * This helper keeps the brand inbox notification when a campaign goes live.
 */
export async function publishCampaignToMarketplace(
  campaign: BrandCampaign,
  _ownerUserId: string,
  _brandName?: string,
  authenticatedRequest?: AuthenticatedRequest,
): Promise<void> {
  if (!campaign.postToMarketplace || campaign.status !== "active") {
    return;
  }

  if (authenticatedRequest) {
    await addInboxNotification(authenticatedRequest, {
      type: "campaign_update",
      title: "Campaign published to marketplace",
      body: `"${campaign.name}" is now live on the marketplace for creators to browse and apply.`,
      href: "/app/marketplace",
      campaignId: campaign.id,
      audience: "brand",
    });
  }
}

export function unpublishCampaignFromMarketplace(_campaignId: string): void {
  // Server removes the listing when the campaign is updated.
}

export function syncAllPostedCampaigns(
  _campaigns: BrandCampaign[],
  _ownerUserId: string,
  _brandName?: string,
): void {
  // No-op — listings are API-backed.
}
