import type { CampaignRecord } from '../campaigns/campaign.repository';
import type { MarketplacePaymentJson } from 'src/dbConfig/drizzle/schema/marketplaceSchema';

export function buildListingPayload(
  campaign: CampaignRecord,
  brandName: string,
) {
  const location = campaign.requirements.location || 'Remote';
  const remoteOk =
    !campaign.requirements.location ||
    campaign.requirements.location.toLowerCase() === 'remote' ||
    campaign.requirements.location.toLowerCase() === 'us';

  return {
    brandName,
    name: campaign.name,
    campaignType: campaign.campaignType,
    type: campaign.type,
    status: resolveListingStatus(campaign),
    startDate: campaign.startDate,
    endDate: campaign.endDate,
    applicationDeadline: campaign.startDate,
    brief: campaign.brief,
    deliverables: campaign.deliverables,
    exampleVideoLinks: campaign.exampleVideoLinks ?? [],
    requirements: buildRequirements(campaign),
    files: campaign.files.map((file) => ({
      id: file.id,
      name: file.name,
      sizeLabel: file.sizeLabel,
    })),
    payment: campaignPaymentToListingPayment(campaign),
    location,
    remoteOk,
    slots: 5,
  };
}

export function resolveListingStatus(
  campaign: CampaignRecord,
): 'open' | 'closing_soon' | 'closed' {
  if (campaign.status === 'completed' || campaign.status === 'paused') {
    return 'closed';
  }
  if (campaign.status !== 'active') {
    return 'closing_soon';
  }
  const today = new Date().toISOString().slice(0, 10);
  if (campaign.endDate < today) return 'closed';
  const soon = new Date();
  soon.setDate(soon.getDate() + 7);
  if (campaign.endDate <= soon.toISOString().slice(0, 10)) {
    return 'closing_soon';
  }
  return 'open';
}

function buildRequirements(campaign: CampaignRecord): string[] {
  const reqs: string[] = [];
  if (campaign.requirements.niches.length) {
    reqs.push(...campaign.requirements.niches);
  }
  if (campaign.requirements.minFollowersRange) {
    reqs.push(`${campaign.requirements.minFollowersRange} followers`);
  }
  if (campaign.requirements.platforms.length) {
    reqs.push(...campaign.requirements.platforms);
  }
  if (campaign.requirements.location) {
    reqs.push(campaign.requirements.location);
  }
  return reqs.length ? reqs : ['See campaign brief'];
}

function campaignPaymentToListingPayment(
  campaign: CampaignRecord,
): MarketplacePaymentJson {
  const payment = campaign.payment;
  switch (payment.model) {
    case 'flat_rate':
      return {
        structure: 'flat_rate',
        currency: 'USD',
        flatAmountCents: payment.flatRateCents ?? 0,
        ...(payment.notes ? { notes: payment.notes } : {}),
      };
    case 'milestone':
      return {
        structure: 'milestone',
        currency: 'USD',
        milestones: payment.milestones?.map((milestone) => ({
          label: milestone.label,
          amountCents: milestone.amountCents,
          trigger: milestone.trigger,
        })),
        ...(payment.notes ? { notes: payment.notes } : {}),
      };
    case 'royalty':
      return {
        structure: 'royalty',
        currency: 'USD',
        royaltyPercent: payment.royaltyPercent ?? 0,
        ...(payment.notes ? { notes: payment.notes } : {}),
      };
    case 'hybrid':
      return {
        structure: 'hybrid',
        currency: 'USD',
        hybridFlatCents: payment.flatRateCents ?? 0,
        hybridRoyaltyPercent: payment.royaltyPercent ?? 0,
        ...(payment.notes ? { notes: payment.notes } : {}),
      };
    default:
      return { structure: 'flat_rate', currency: 'USD', flatAmountCents: 0 };
  }
}
