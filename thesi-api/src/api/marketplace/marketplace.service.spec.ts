import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CampaignRecord } from '../campaigns/campaign.repository';
import type {
  MarketplaceApplicationRecord,
  MarketplaceListingRecord,
  MarketplaceRepository,
  MarketplaceUser,
  UpsertListingFromCampaignInput,
} from './marketplace.repository';
import { MarketplaceService } from './marketplace.service';

class FakeMarketplaceRepository implements MarketplaceRepository {
  user: MarketplaceUser | null = null;
  brandName: string | null = 'Acme Brand';
  listings: MarketplaceListingRecord[] = [];
  applications: MarketplaceApplicationRecord[] = [];
  crmLinks = new Set<string>();

  async getUser() {
    return this.user;
  }

  async getBrandDisplayName() {
    return this.brandName;
  }

  async upsertListingFromCampaign(input: UpsertListingFromCampaignInput) {
    const existing = this.listings.find(
      (listing) => listing.campaignId === input.campaign.id,
    );
    const listing: MarketplaceListingRecord = {
      id: existing?.id ?? `listing-${input.campaign.id}`,
      name: input.campaign.name,
      brandName: input.brandName,
      ownerUserId: input.ownerUserId,
      campaignId: input.campaign.id,
      campaignType: input.campaign.campaignType,
      type: input.campaign.type,
      status: 'open',
      startDate: input.campaign.startDate,
      endDate: input.campaign.endDate,
      applicationDeadline: input.campaign.startDate,
      brief: input.campaign.brief,
      deliverables: input.campaign.deliverables,
      exampleVideoLinks: input.campaign.exampleVideoLinks ?? [],
      requirements: ['Fitness'],
      files: input.campaign.files,
      payment: {
        structure: 'flat_rate',
        currency: 'USD',
        flatAmountCents: input.campaign.payment.flatRateCents ?? 0,
      },
      location: input.campaign.requirements.location || 'Remote',
      remoteOk: true,
      slots: 5,
      applicantsCount: 0,
      postedAt: new Date().toISOString(),
    };
    this.listings = [
      ...this.listings.filter((item) => item.campaignId !== input.campaign.id),
      listing,
    ];
    return listing;
  }

  async deleteListingByCampaignId(campaignId: string) {
    this.listings = this.listings.filter(
      (listing) => listing.campaignId !== campaignId,
    );
  }

  async listAll() {
    return this.listings;
  }

  async listByOwner(ownerUserId: string) {
    return this.listings.filter((listing) => listing.ownerUserId === ownerUserId);
  }

  async getById(listingId: string) {
    return this.listings.find((listing) => listing.id === listingId) ?? null;
  }

  async listApplicationsForCreator() {
    return this.applications;
  }

  async listCrmLinkedListingIds(creatorUserId: string) {
    return [...this.crmLinks]
      .filter((key) => key.startsWith(`${creatorUserId}:`))
      .map((key) => key.split(':')[1]!);
  }

  async hasApplied(listingId: string, _creatorUserId: string) {
    return this.applications.some((app) => app.listingId === listingId);
  }

  async createApplication(input: {
    listingId: string;
    creatorUserId: string;
    pitch: string;
    addedToCrm: boolean;
  }) {
    const application: MarketplaceApplicationRecord = {
      id: `${input.creatorUserId}-app-${this.applications.length + 1}`,
      listingId: input.listingId,
      pitch: input.pitch,
      appliedAt: new Date().toISOString(),
      addedToCrm: input.addedToCrm,
    };
    this.applications.push(application);
    if (input.addedToCrm) {
      await this.linkCrm(input.creatorUserId, input.listingId);
    }
    return application;
  }

  async linkCrm(creatorUserId: string, listingId: string) {
    this.crmLinks.add(`${creatorUserId}:${listingId}`);
  }
}

describe('MarketplaceService', () => {
  let repository: FakeMarketplaceRepository;
  let service: MarketplaceService;

  beforeEach(() => {
    repository = new FakeMarketplaceRepository();
    const creatorCrm = {
      addListingToPipeline: jest.fn().mockResolvedValue(undefined),
    };
    service = new MarketplaceService(
      repository,
      creatorCrm as never,
    );
  });

  it('publishes active marketplace campaigns and removes unpublished ones', async () => {
    repository.user = {
      id: 'brand-1',
      role: 'brand',
      fullName: 'Brand',
      companyName: 'Acme',
    };
    const campaign = sampleCampaign({
      postToMarketplace: true,
      status: 'active',
    });

    await service.syncFromCampaign('brand-1', campaign);
    expect(repository.listings).toHaveLength(1);

    await service.syncFromCampaign('brand-1', {
      ...campaign,
      postToMarketplace: false,
    });
    expect(repository.listings).toHaveLength(0);
  });

  it('lets creators apply once', async () => {
    repository.user = {
      id: 'creator-1',
      role: 'creator',
      fullName: 'Creator',
      companyName: null,
    };
    repository.listings = [
      {
        id: 'listing-1',
        name: 'Summer',
        brandName: 'Acme',
        ownerUserId: 'brand-1',
        campaignId: 'campaign-1',
        campaignType: 'experience',
        type: 'tiktok',
        status: 'open',
        startDate: '2026-07-01',
        endDate: '2026-08-01',
        applicationDeadline: '2026-07-01',
        brief: 'Brief',
        deliverables: '1 video',
        exampleVideoLinks: [],
        requirements: [],
        files: [],
        payment: { structure: 'flat_rate', currency: 'USD', flatAmountCents: 1000 },
        location: 'Remote',
        remoteOk: true,
        slots: 5,
        applicantsCount: 0,
        postedAt: new Date().toISOString(),
      },
    ];

    await expect(
      service.apply('creator-1', 'listing-1', 'I am a fit', true),
    ).resolves.toEqual(
      expect.objectContaining({
        application: expect.objectContaining({ pitch: 'I am a fit' }),
        crmLinkedListingIds: ['listing-1'],
      }),
    );

    await expect(
      service.apply('creator-1', 'listing-1', 'Again', false),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks brands from applying', async () => {
    repository.user = {
      id: 'brand-1',
      role: 'brand',
      fullName: 'Brand',
      companyName: 'Acme',
    };

    await expect(
      service.apply('brand-1', 'listing-1', 'Nope', false),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('returns not found for missing listings', async () => {
    repository.user = {
      id: 'creator-1',
      role: 'creator',
      fullName: 'Creator',
      companyName: null,
    };

    await expect(
      service.getListing('creator-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects empty pitches', async () => {
    repository.user = {
      id: 'creator-1',
      role: 'creator',
      fullName: 'Creator',
      companyName: null,
    };
    repository.listings = [
      {
        id: 'listing-1',
        name: 'Summer',
        brandName: 'Acme',
        ownerUserId: 'brand-1',
        campaignId: 'campaign-1',
        campaignType: 'experience',
        type: 'tiktok',
        status: 'open',
        startDate: '2026-07-01',
        endDate: '2026-08-01',
        applicationDeadline: '2026-07-01',
        brief: 'Brief',
        deliverables: '1 video',
        exampleVideoLinks: [],
        requirements: [],
        files: [],
        payment: { structure: 'flat_rate', currency: 'USD', flatAmountCents: 1000 },
        location: 'Remote',
        remoteOk: true,
        slots: 5,
        applicantsCount: 0,
        postedAt: new Date().toISOString(),
      },
    ];

    await expect(
      service.apply('creator-1', 'listing-1', '   ', false),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function sampleCampaign(
  overrides: Partial<CampaignRecord> = {},
): CampaignRecord {
  return {
    id: 'campaign-1',
    name: 'Summer UGC',
    campaignType: 'experience',
    type: 'tiktok',
    status: 'active',
    startDate: '2026-07-01',
    endDate: '2026-08-01',
    brief: 'Brief',
    deliverables: '1 video',
    exampleVideoLinks: [],
    requirements: {
      niches: ['Fitness'],
      minFollowersRange: '5k+',
      location: 'US',
      platforms: ['TikTok'],
    },
    files: [],
    payment: { model: 'flat_rate', flatRateCents: 25000 },
    postToMarketplace: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}
