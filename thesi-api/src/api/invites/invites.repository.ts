export const INVITES_REPOSITORY = Symbol('INVITES_REPOSITORY');

export type InviteStatus = 'sent' | 'accepted' | 'declined';

export type InviteUser = {
  id: string;
  role: string;
  email: string;
  fullName: string;
};

export type CampaignInviteRecord = {
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
};

export type PlatformBrandInviteRecord = {
  id: string;
  brandName: string;
  brandEmail: string;
  invitedBy: string;
  invitedByEmail: string;
  message?: string;
  addToCrm: boolean;
  crmBrandId?: string;
  status: InviteStatus;
  sentAt: string;
};

export type CreateCampaignInviteInput = {
  campaignId: string;
  brandUserId: string;
  campaignName: string;
  brandName: string;
  creatorUserId?: string | null;
  creatorEmail: string;
  creatorName: string;
  external: boolean;
};

export type CreatePlatformBrandInviteInput = {
  invitedByUserId: string;
  brandName: string;
  brandEmail: string;
  invitedByName: string;
  invitedByEmail: string;
  message?: string | null;
  addToCrm: boolean;
  crmBrandId?: string | null;
};

export interface InvitesRepository {
  getUser(userId: string): Promise<InviteUser | null>;
  findUserByEmail(email: string): Promise<InviteUser | null>;
  findOwnedCampaign(
    brandUserId: string,
    campaignId: string,
  ): Promise<{ id: string; name: string } | null>;
  listCampaignInvites(
    brandUserId: string,
    campaignId?: string,
  ): Promise<CampaignInviteRecord[]>;
  findCampaignInviteByEmail(
    campaignId: string,
    creatorEmail: string,
  ): Promise<CampaignInviteRecord | null>;
  createCampaignInvite(
    input: CreateCampaignInviteInput,
  ): Promise<CampaignInviteRecord>;
  setCampaignInviteNovuTransactionId(
    inviteId: string,
    transactionId: string,
  ): Promise<void>;
  listPlatformBrandInvites(
    invitedByUserId: string,
  ): Promise<PlatformBrandInviteRecord[]>;
  findPlatformBrandInviteByEmail(
    invitedByUserId: string,
    brandEmail: string,
  ): Promise<PlatformBrandInviteRecord | null>;
  createPlatformBrandInvite(
    input: CreatePlatformBrandInviteInput,
  ): Promise<PlatformBrandInviteRecord>;
  setPlatformBrandInviteNovuTransactionId(
    inviteId: string,
    transactionId: string,
  ): Promise<void>;
}
