import type { BrandCampaign } from "./types";

export type CampaignRevisionTerms = Pick<
  BrandCampaign,
  | "name"
  | "campaignType"
  | "contentTypes"
  | "startDate"
  | "endDate"
  | "brief"
  | "deliverables"
  | "exampleVideoLinks"
  | "requirements"
  | "files"
  | "payment"
  | "requiredTasks"
  | "creatorBenefits"
  | "contentRights"
  | "productsProvided"
  | "creatorDisclosureEnabled"
>;

export type CampaignRevision = {
  id: string;
  campaignId: string;
  version: number;
  terms: CampaignRevisionTerms;
  createdByUserId: string;
  createdAt: string;
  isCurrent: boolean;
  appliedCount: number;
  pendingCount: number;
  acceptedCreators: Array<{
    name: string;
    email: string;
    acceptedAt: string;
  }>;
};

export function campaignFromRevision(
  campaign: BrandCampaign,
  revision: CampaignRevision,
): BrandCampaign {
  return {
    ...campaign,
    ...revision.terms,
    id: campaign.id,
    status: campaign.status,
    postToMarketplace: campaign.postToMarketplace,
    creatorCapacity: campaign.creatorCapacity,
    createdAt: campaign.createdAt,
    updatedAt: revision.createdAt,
    currentRevisionId: revision.id,
  };
}
