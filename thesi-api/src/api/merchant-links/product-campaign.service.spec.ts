import { ConfigService } from '@nestjs/config';
import { ProductCampaignService, type ProductCampaignInput } from './product-campaign.service';
import type { CampaignRecord } from '../campaigns/campaign.repository';

const productId = '22222222-2222-4222-8222-222222222222';
const input: ProductCampaignInput = {
  vendorId: '11111111-1111-4111-8111-111111111111',
  brandId: '33333333-3333-4333-8333-333333333333',
  productId,
  campaignId: '44444444-4444-4444-8444-444444444444',
  name: 'Linen Summer Shirt',
  description: 'A light shirt',
  startDate: '2026-10-10',
  endDate: '2026-11-10',
  brief: 'Show the shirt in daylight.',
  deliverables: 'One short video.',
  contentTypes: ['tiktok'],
  commissionType: 'percentage_of_sale',
  commissionPercent: 15,
  notes: 'Pay after the sale is confirmed.',
  attributionWindowDays: 30,
  creatorSlots: 5,
  reviewDays: 30,
  payoutFrequency: 'on_approval',
  minimumPayoutCents: 0,
};

function campaign(id: string, status: CampaignRecord['status'], updatedAt: string, percent = 15): CampaignRecord {
  return {
    id,
    name: 'Linen Summer Shirt',
    description: 'A light shirt',
    campaignType: 'product',
    contentTypes: ['tiktok'],
    status,
    startDate: input.startDate,
    endDate: input.endDate,
    brief: input.brief,
    deliverables: input.deliverables,
    exampleVideoLinks: [],
    requirements: { niches: [], minFollowersRange: '', location: '', platforms: [] },
    files: [],
    payment: {
      model: 'commission',
      promotedProduct: { productId, title: 'Linen Summer Shirt', variants: [{ id: 'variant-1', price: 40 }] } as CampaignRecord['payment']['promotedProduct'],
      hybrid: { affiliate: { commissionType: 'percentage_of_sale', commissionPercent: percent, attributionWindowDays: 30, terms: input.notes } },
    },
    requiredTasks: [],
    creatorBenefits: {
      productsKept: false, bonusEligibility: false, creatorPoolEligibility: false, foundingCreatorRecognition: false,
      portfolioUse: false, priorityFutureCampaigns: false, brandOpportunityAccess: false, customBenefits: [],
    },
    contentRights: { organicUsage: true, websiteAppUsage: false, paidAdsUsage: false, duration: '', rawContentAccess: false },
    productsProvided: [],
    creatorCapacity: 5,
    creatorDisclosureEnabled: false,
    postToMarketplace: status === 'active',
    createdAt: updatedAt,
    updatedAt,
  };
}

describe('Product campaign lookup', () => {
  const campaigns = { list: jest.fn(), update: jest.fn(), create: jest.fn(), get: jest.fn() };
  const db = { execute: jest.fn() };
  const config = { get: (key: string) => key === 'MERCHANT_LINKING_ENABLED' } as unknown as ConfigService;
  const service = new ProductCampaignService(db as never, config, campaigns as never);

  beforeEach(() => {
    jest.clearAllMocks();
    db.execute.mockResolvedValue({ rows: [{ id: 'link', workspace_id: 'workspace', linked_by_user_id: 'owner' }] });
    campaigns.update.mockImplementation(async (_user: string, id: string, patch: Partial<CampaignRecord>) => ({ ...campaign(id, 'active', '2026-10-07T00:00:00.000Z'), ...patch, id }));
    campaigns.create.mockImplementation(async () => campaign('new-campaign', 'active', '2026-10-08T00:00:00.000Z'));
  });

  it('updates the active campaign for the product and does not insert another', async () => {
    const active = campaign('active-campaign', 'active', '2026-10-07T00:00:00.000Z');
    campaigns.list.mockResolvedValue({ campaigns: [active] });
    const view = await service.upsert({ ...input, campaignId: undefined });
    expect(view.id).toBe('active-campaign');
    expect(campaigns.create).not.toHaveBeenCalled();
    const patch = campaigns.update.mock.calls[0][2];
    expect(patch.payment.promotedProduct).toEqual(active.payment.promotedProduct);
    expect(patch.merchantProductId).toBeUndefined();
  });

  it('uses the active campaign when the saved id points at a paused one', async () => {
    campaigns.list.mockResolvedValue({
      campaigns: [
        campaign('paused-campaign', 'paused', '2026-10-08T00:00:00.000Z'),
        campaign('active-campaign', 'active', '2026-10-07T00:00:00.000Z'),
      ],
    });
    await service.upsert({ ...input, campaignId: 'paused-campaign' });
    expect(campaigns.update.mock.calls[0][1]).toBe('active-campaign');
    expect(campaigns.create).not.toHaveBeenCalled();
  });

  it('pauses the active campaign and creates one replacement when the rate changes', async () => {
    campaigns.list.mockResolvedValue({ campaigns: [campaign('active-campaign', 'active', '2026-10-07T00:00:00.000Z', 15)] });
    const view = await service.upsert({ ...input, commissionPercent: 20 });
    expect(campaigns.update.mock.calls[0][2]).toMatchObject({ status: 'paused', postToMarketplace: false });
    expect(campaigns.create).toHaveBeenCalledTimes(1);
    expect(campaigns.create.mock.calls[0][1].payment.promotedProduct).toBeUndefined();
    expect(campaigns.create.mock.calls[0][1].payment.hybrid.affiliate.commissionPercent).toBe(20);
    expect(view.id).toBe('new-campaign');
    expect(view.replaced).toBe(true);
  });

  it('keeps the saved product snapshot when only the brief changes', async () => {
    const active = campaign('active-campaign', 'active', '2026-10-07T00:00:00.000Z');
    campaigns.list.mockResolvedValue({ campaigns: [active] });
    await service.upsert({ ...input, brief: 'Show the shirt outdoors.' });
    expect(campaigns.update.mock.calls[0][2].payment).toBe(active.payment);
    expect(campaigns.create).not.toHaveBeenCalled();
  });

  it('creates one campaign when the only match is paused or missing', async () => {
    campaigns.list.mockResolvedValue({ campaigns: [campaign('paused-campaign', 'paused', '2026-10-07T00:00:00.000Z')] });
    await service.upsert({ ...input, campaignId: 'missing-campaign' });
    expect(campaigns.get).not.toHaveBeenCalled();
    expect(campaigns.update).not.toHaveBeenCalled();
    expect(campaigns.create).toHaveBeenCalledTimes(1);
  });
});
