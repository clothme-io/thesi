export type InviteStatus = "sent" | "accepted" | "declined";

export interface CampaignInvite {
  id: string;
  campaignId: string;
  campaignName: string;
  brandName: string;
  creatorId?: string;
  creatorEmail: string;
  creatorName: string;
  external: boolean;
  status: InviteStatus;
  sentAt: string;
}

export interface InviteData {
  invites: CampaignInvite[];
}

export interface CampaignInviteCriteria {
  niches: string[];
  minFollowersRange: string;
  location: string;
  platforms: string[];
}
