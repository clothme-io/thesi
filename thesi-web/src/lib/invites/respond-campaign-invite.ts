import type { CampaignInvite, InviteStatus } from "./types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

export async function respondToCampaignInvite(
  authenticatedRequest: AuthenticatedRequest,
  campaignId: string,
  decision: Exclude<InviteStatus, "sent">,
): Promise<CampaignInvite> {
  return authenticatedRequest<CampaignInvite>("/api/invites/campaign/respond", {
    method: "POST",
    body: { campaignId, decision },
  });
}

export async function getReceivedCampaignInvite(
  authenticatedRequest: AuthenticatedRequest,
  campaignId: string,
): Promise<CampaignInvite | null> {
  const data = await authenticatedRequest<{ invite: CampaignInvite | null }>(
    `/api/invites/campaign/received?campaignId=${encodeURIComponent(campaignId)}`,
  );
  return data.invite;
}
