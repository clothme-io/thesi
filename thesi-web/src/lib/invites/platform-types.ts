export type PlatformInviteStatus = "sent" | "accepted" | "declined";

export interface PlatformBrandInvite {
  id: string;
  brandName: string;
  brandEmail: string;
  invitedBy: string;
  invitedByEmail: string;
  message?: string;
  addToCrm: boolean;
  crmBrandId?: string;
  status: PlatformInviteStatus;
  sentAt: string;
}

export interface PlatformInviteData {
  brandInvites: PlatformBrandInvite[];
}
