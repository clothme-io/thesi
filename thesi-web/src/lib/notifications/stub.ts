/**
 * Client-side notification helpers were replaced by Nest NovuService.
 * Invite email/out-of-app delivery is triggered server-side on invite create.
 */

export type NotificationEvent =
  | {
      type: "campaign_invite";
      toEmail: string;
      creatorName: string;
      brandName: string;
      campaignName: string;
      campaignId: string;
    }
  | {
      type: "platform_invite_brand";
      toEmail: string;
      brandName: string;
      invitedBy: string;
    }
  | {
      type: "platform_invite_creator";
      toEmail: string;
      creatorName: string;
      invitedBy: string;
    };

/** @deprecated Prefer server-side Novu triggers via /api/invites. */
export async function sendStubNotification(event: NotificationEvent): Promise<void> {
  if (typeof window !== "undefined") {
    console.info("[thesi-notifications] server-owned; client stub no-op", event.type);
  }
}
