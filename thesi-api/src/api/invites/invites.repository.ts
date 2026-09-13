import type {
  CampaignContentRightsJson,
  CampaignCreatorBenefitsJson,
  CampaignPaymentJson,
  CampaignProductProvidedJson,
  CampaignRequiredTaskJson,
} from 'src/dbConfig/drizzle/schema';

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
  brandUserId: string;
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

export type CreateAcceptanceSnapshotInput = {
  campaignId: string;
  brandUserId: string;
  creatorUserId?: string | null;
  creatorEmail: string;
  creatorName: string;
  source: 'campaign_invite' | 'marketplace_application';
  sourceId: string;
  acceptedAt?: Date;
};

export type CampaignAcceptanceSnapshotRecord = {
  id: string;
  campaignId: string;
  brandUserId: string;
  creatorUserId?: string;
  creatorEmail: string;
  creatorName: string;
  source: 'campaign_invite' | 'marketplace_application';
  sourceId: string;
  campaignName: string;
  campaignType: string;
  contentTypes: string[];
  startDate: string;
  endDate: string;
  brief: string;
  deliverables: string;
  paymentSnapshot: CampaignPaymentJson;
  creatorBenefitsSnapshot: CampaignCreatorBenefitsJson;
  productsProvidedSnapshot: CampaignProductProvidedJson[];
  contentRightsSnapshot: CampaignContentRightsJson;
  requiredTasksSnapshot: CampaignRequiredTaskJson[];
  creatorCapacitySnapshot?: number;
  acceptedAt: string;
  createdAt: string;
};

export interface InvitesRepository {
  getUser(userId: string): Promise<InviteUser | null>;
  findUserByEmail(email: string): Promise<InviteUser | null>;
  findOwnedCampaign(
    brandUserId: string,
    campaignId: string,
  ): Promise<{ id: string; name: string; payment?: CampaignPaymentJson } | null>;
  listCampaignInvites(
    brandUserId: string,
    campaignId?: string,
  ): Promise<CampaignInviteRecord[]>;
  findCampaignInviteByEmail(
    campaignId: string,
    creatorEmail: string,
  ): Promise<CampaignInviteRecord | null>;
  findCampaignInviteForCreator(
    campaignId: string,
    creatorUserId: string,
    creatorEmail: string,
  ): Promise<CampaignInviteRecord | null>;
  createCampaignInvite(
    input: CreateCampaignInviteInput,
  ): Promise<CampaignInviteRecord>;
  upsertAcceptedCampaignInvite(
    input: CreateCampaignInviteInput,
  ): Promise<CampaignInviteRecord>;
  updateCampaignInviteStatus(
    inviteId: string,
    status: Exclude<InviteStatus, 'sent'>,
  ): Promise<CampaignInviteRecord | null>;
  createAcceptanceSnapshot(
    input: CreateAcceptanceSnapshotInput,
  ): Promise<void>;
  getAcceptanceSnapshotForCreator(
    campaignId: string,
    creatorUserId: string,
    creatorEmail: string,
  ): Promise<CampaignAcceptanceSnapshotRecord | null>;
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
