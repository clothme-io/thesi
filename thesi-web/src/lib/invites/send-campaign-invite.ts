import type { CampaignInvite } from "./types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

export interface SendCampaignInviteInput {
  campaignId: string;
  campaignName: string;
  brandName: string;
  creatorId?: string;
  creatorEmail: string;
  creatorName: string;
  external: boolean;
}

export async function sendCampaignInvite(
  input: SendCampaignInviteInput,
  authenticatedRequest: AuthenticatedRequest,
): Promise<CampaignInvite> {
  return authenticatedRequest<CampaignInvite>("/api/invites/campaign", {
    method: "POST",
    body: {
      campaignId: input.campaignId,
      campaignName: input.campaignName,
      brandName: input.brandName,
      creatorId: input.creatorId,
      creatorEmail: input.creatorEmail,
      creatorName: input.creatorName,
      external: input.external,
    },
  });
}
