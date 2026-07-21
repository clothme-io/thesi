import type { UpsertCampaignDto } from './dto/campaign.dto';

export const CAMPAIGN_REPOSITORY = Symbol('CAMPAIGN_REPOSITORY');

export type CampaignUser = {
  id: string;
  role: string;
};

export type CampaignFileMeta = {
  id: string;
  name: string;
  sizeLabel: string;
};

export type CampaignFileRow = {
  id: string;
  campaignId: string;
  ownerUserId: string;
  originalName: string;
  sizeBytes: number;
  contentType: string;
  storageProvider: 'local' | 'bunny';
  storageKey: string;
  createdAt: string;
};

export type CampaignRecord = {
  id: string;
  name: string;
  campaignType: UpsertCampaignDto['campaignType'];
  type: UpsertCampaignDto['type'];
  status: UpsertCampaignDto['status'];
  startDate: string;
  endDate: string;
  brief: string;
  deliverables: string;
  exampleVideoLinks: string[];
  requirements: UpsertCampaignDto['requirements'];
  files: CampaignFileMeta[];
  payment: UpsertCampaignDto['payment'];
  postToMarketplace: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateCampaignFileInput = {
  campaignId: string;
  ownerUserId: string;
  originalName: string;
  sizeBytes: number;
  contentType: string;
  storageProvider: 'local' | 'bunny';
  storageKey: string;
};

export type CampaignPlatformFeeRecord = {
  id: string;
  campaignId: string;
  brandUserId: string;
  payoutCents: number;
  feeCents: number;
  currency: string;
  status: 'pending' | 'paid' | 'failed' | 'waived';
  stripePaymentIntentId?: string;
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

export type CreatorPayoutRecord = {
  id: string;
  campaignId: string;
  brandUserId: string;
  creatorUserId: string;
  amountCents: number;
  currency: string;
  status: 'pending' | 'charged' | 'transferred' | 'failed';
  stripePaymentIntentId?: string;
  stripeTransferId?: string;
  stripeDestinationAccountId: string;
  idempotencyKey: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
};

export interface CampaignRepository {
  getUser(userId: string): Promise<CampaignUser | null>;
  listByOwner(ownerUserId: string): Promise<CampaignRecord[]>;
  getByIdForOwner(
    ownerUserId: string,
    campaignId: string,
  ): Promise<CampaignRecord | null>;
  create(
    ownerUserId: string,
    input: UpsertCampaignDto,
  ): Promise<CampaignRecord>;
  update(
    ownerUserId: string,
    campaignId: string,
    input: UpsertCampaignDto,
  ): Promise<CampaignRecord | null>;
  createFile(input: CreateCampaignFileInput): Promise<CampaignFileRow>;
  listFiles(campaignId: string): Promise<CampaignFileRow[]>;
  getFileForOwner(
    ownerUserId: string,
    campaignId: string,
    fileId: string,
  ): Promise<CampaignFileRow | null>;
  deleteFile(
    ownerUserId: string,
    campaignId: string,
    fileId: string,
  ): Promise<CampaignFileRow | null>;
  syncCampaignFilesJson(
    campaignId: string,
    files: CampaignFileMeta[],
  ): Promise<void>;
  getPlatformFee(
    campaignId: string,
  ): Promise<CampaignPlatformFeeRecord | null>;
  upsertPlatformFee(input: {
    campaignId: string;
    brandUserId: string;
    payoutCents: number;
    feeCents: number;
    currency?: string;
    status: CampaignPlatformFeeRecord['status'];
    stripePaymentIntentId?: string | null;
    idempotencyKey: string;
  }): Promise<CampaignPlatformFeeRecord>;
  getCreatorPayout(
    campaignId: string,
    creatorUserId: string,
  ): Promise<CreatorPayoutRecord | null>;
  listCreatorPayoutsForCampaign(
    campaignId: string,
  ): Promise<CreatorPayoutRecord[]>;
  listCreatorPayoutsForCreator(
    creatorUserId: string,
  ): Promise<CreatorPayoutRecord[]>;
  upsertCreatorPayout(input: {
    campaignId: string;
    brandUserId: string;
    creatorUserId: string;
    amountCents: number;
    currency?: string;
    status: CreatorPayoutRecord['status'];
    stripePaymentIntentId?: string | null;
    stripeTransferId?: string | null;
    stripeDestinationAccountId: string;
    idempotencyKey: string;
    failureReason?: string | null;
  }): Promise<CreatorPayoutRecord>;
}
