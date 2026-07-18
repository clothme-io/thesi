import type { CampaignRecord } from '../campaigns/campaign.repository';
import type { MarketplacePaymentJson } from 'src/dbConfig/drizzle/schema/marketplaceSchema';

export const MARKETPLACE_REPOSITORY = Symbol('MARKETPLACE_REPOSITORY');
export const MARKETPLACE_CAMPAIGN_SYNC = Symbol('MARKETPLACE_CAMPAIGN_SYNC');

export type MarketplaceUser = {
  id: string;
  role: string;
  fullName: string;
  companyName: string | null;
};

export type MarketplaceListingRecord = {
  id: string;
  name: string;
  brandName: string;
  brandId?: string;
  ownerUserId: string;
  campaignId: string;
  type: CampaignRecord['type'];
  status: 'open' | 'closing_soon' | 'closed';
  startDate: string;
  endDate: string;
  applicationDeadline: string;
  brief: string;
  deliverables: string;
  requirements: string[];
  files: Array<{ id: string; name: string; sizeLabel: string }>;
  payment: MarketplacePaymentJson;
  location: string;
  remoteOk: boolean;
  slots: number;
  applicantsCount: number;
  postedAt: string;
};

export type MarketplaceApplicationRecord = {
  id: string;
  listingId: string;
  pitch: string;
  appliedAt: string;
  addedToCrm: boolean;
};

export type UpsertListingFromCampaignInput = {
  ownerUserId: string;
  brandName: string;
  campaign: CampaignRecord;
};

export interface MarketplaceRepository {
  getUser(userId: string): Promise<MarketplaceUser | null>;
  getBrandDisplayName(userId: string): Promise<string | null>;
  upsertListingFromCampaign(
    input: UpsertListingFromCampaignInput,
  ): Promise<MarketplaceListingRecord>;
  deleteListingByCampaignId(campaignId: string): Promise<void>;
  listAll(): Promise<MarketplaceListingRecord[]>;
  listByOwner(ownerUserId: string): Promise<MarketplaceListingRecord[]>;
  getById(listingId: string): Promise<MarketplaceListingRecord | null>;
  listApplicationsForCreator(
    creatorUserId: string,
  ): Promise<MarketplaceApplicationRecord[]>;
  listCrmLinkedListingIds(creatorUserId: string): Promise<string[]>;
  hasApplied(listingId: string, creatorUserId: string): Promise<boolean>;
  createApplication(input: {
    listingId: string;
    creatorUserId: string;
    pitch: string;
    addedToCrm: boolean;
  }): Promise<MarketplaceApplicationRecord>;
  linkCrm(creatorUserId: string, listingId: string): Promise<void>;
}

export interface MarketplaceCampaignSync {
  syncFromCampaign(
    ownerUserId: string,
    campaign: CampaignRecord,
  ): Promise<void>;
}
