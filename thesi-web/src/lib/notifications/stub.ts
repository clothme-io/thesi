/**
 * Stub notification sender for development.
 * TODO: Replace with Novu workflow triggers for production email + in-app delivery.
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

export async function sendStubNotification(event: NotificationEvent): Promise<void> {
  // TODO(Novu): dispatch workflow based on event.type with template variables.
  if (typeof window !== "undefined") {
    console.info("[thesi-notifications stub]", event);
  }
}
