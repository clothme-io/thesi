import type { BrandCampaign } from "@/lib/brand-campaigns/types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

/**
 * Marketplace listings and brand inbox notifications are owned by thesi-api
 * when campaigns are created or updated.
 */
export async function publishCampaignToMarketplace(
  _campaign: BrandCampaign,
  _ownerUserId: string,
  _brandName?: string,
  _authenticatedRequest?: AuthenticatedRequest,
): Promise<void> {
  return;
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
