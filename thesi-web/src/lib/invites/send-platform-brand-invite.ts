import type { PlatformBrandInvite } from "./platform-types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

export interface SendPlatformBrandInviteInput {
  brandName: string;
  brandEmail: string;
  invitedBy: string;
  invitedByEmail: string;
  message?: string;
  addToCrm: boolean;
}

export async function sendPlatformBrandInvite(
  input: SendPlatformBrandInviteInput,
  authenticatedRequest: AuthenticatedRequest,
): Promise<PlatformBrandInvite> {
  return authenticatedRequest<PlatformBrandInvite>("/api/invites/platform-brand", {
    method: "POST",
    body: {
      brandName: input.brandName,
      brandEmail: input.brandEmail,
      invitedBy: input.invitedBy,
      invitedByEmail: input.invitedByEmail,
      message: input.message,
      addToCrm: input.addToCrm,
    },
  });
}
