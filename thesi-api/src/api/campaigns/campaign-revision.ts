import { isDeepStrictEqual } from 'node:util';
import type { CampaignRevisionTermsJson } from 'src/dbConfig/drizzle/schema/campaignSchema';
import type { CampaignRecord } from './campaign.repository';
import type { UpsertCampaignDto } from './dto/campaign.dto';

export type CampaignRevisionTerms = CampaignRevisionTermsJson;

export function isPublishedCampaignStatus(
  status: CampaignRecord['status'] | UpsertCampaignDto['status'],
): boolean {
  return status !== 'draft';
}

export function termsFromCampaign(
  campaign: Pick<
    CampaignRecord,
    | 'name'
    | 'campaignType'
    | 'contentTypes'
    | 'startDate'
    | 'endDate'
    | 'brief'
    | 'deliverables'
    | 'exampleVideoLinks'
    | 'requirements'
    | 'files'
    | 'payment'
    | 'requiredTasks'
    | 'creatorBenefits'
    | 'contentRights'
    | 'productsProvided'
    | 'creatorDisclosureEnabled'
  >,
): CampaignRevisionTerms {
  return {
    name: campaign.name,
    campaignType: campaign.campaignType,
    contentTypes: campaign.contentTypes,
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    brief: campaign.brief,
    deliverables: campaign.deliverables,
    exampleVideoLinks: campaign.exampleVideoLinks,
    requirements: campaign.requirements,
    files: campaign.files,
    payment: campaign.payment,
    requiredTasks: campaign.requiredTasks,
    creatorBenefits: campaign.creatorBenefits,
    contentRights: campaign.contentRights,
    productsProvided: campaign.productsProvided,
    creatorDisclosureEnabled: campaign.creatorDisclosureEnabled,
  };
}

export function sameMaterialTerms(
  left: CampaignRevisionTerms,
  right: CampaignRevisionTerms,
): boolean {
  return isDeepStrictEqual(left, right);
}

export function termsToCampaignPatch(
  terms: CampaignRevisionTerms,
): Pick<
  UpsertCampaignDto,
  | 'name'
  | 'campaignType'
  | 'contentTypes'
  | 'startDate'
  | 'endDate'
  | 'brief'
  | 'deliverables'
  | 'exampleVideoLinks'
  | 'requirements'
  | 'files'
  | 'payment'
  | 'requiredTasks'
  | 'creatorBenefits'
  | 'contentRights'
  | 'productsProvided'
  | 'creatorDisclosureEnabled'
> {
  return {
    name: terms.name,
    campaignType: terms.campaignType as UpsertCampaignDto['campaignType'],
    contentTypes: terms.contentTypes as UpsertCampaignDto['contentTypes'],
    startDate: terms.startDate,
    endDate: terms.endDate,
    brief: terms.brief,
    deliverables: terms.deliverables,
    exampleVideoLinks: terms.exampleVideoLinks,
    requirements: terms.requirements,
    files: terms.files,
    payment: terms.payment,
    requiredTasks: terms.requiredTasks,
    creatorBenefits: terms.creatorBenefits,
    contentRights: terms.contentRights,
    productsProvided: terms.productsProvided,
    creatorDisclosureEnabled: terms.creatorDisclosureEnabled,
  };
}
