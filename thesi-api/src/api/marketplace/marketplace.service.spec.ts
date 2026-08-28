import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { CampaignRecord } from '../campaigns/campaign.repository';
import type {
  MarketplaceApplicationRecord,
  MarketplaceBrandApplicationRecord,
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
  applications: Array<
    MarketplaceApplicationRecord & {
      creatorUserId: string;
      creatorName?: string;
      creatorEmail?: string;
    }
  > = [];
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
    const status =
      input.campaign.status === 'paused' ||
      input.campaign.status === 'completed'
        ? 'closed'
        : 'open';
    const listing: MarketplaceListingRecord = {
      id: existing?.id ?? `listing-${input.campaign.id}`,
      name: input.campaign.name,
      brandName: input.brandName,
      ownerUserId: input.ownerUserId,
      campaignId: input.campaign.id,
      campaignType: input.campaign.campaignType,
      type: input.campaign.type,
      status,
      startDate: input.campaign.startDate,
      endDate: input.campaign.endDate,
      applicationDeadline: input.campaign.endDate,
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

  async listApplicationsForCreator(creatorUserId: string) {
    return this.applications.filter((app) => app.creatorUserId === creatorUserId);
  }

  async listApplicationsForListing(
    listingId: string,
  ): Promise<MarketplaceBrandApplicationRecord[]> {
    return this.applications
      .filter((app) => app.listingId === listingId)
      .map((app) => ({
        id: app.id,
        listingId: app.listingId,
        pitch: app.pitch,
        appliedAt: app.appliedAt,
        addedToCrm: app.addedToCrm,
        status: app.status ?? 'pending',
        creatorUserId: app.creatorUserId,
        creatorName: app.creatorName || 'Creator',
        creatorEmail: app.creatorEmail || 'creator@example.com',
      }));
  }

  async listCrmLinkedListingIds(creatorUserId: string) {
    return [...this.crmLinks]
      .filter((key) => key.startsWith(`${creatorUserId}:`))
      .map((key) => key.split(':')[1]!);
  }

  async hasApplied(listingId: string, creatorUserId: string) {
    return this.applications.some(
      (app) =>
        app.listingId === listingId && app.creatorUserId === creatorUserId,
    );
  }

  async createApplication(input: {
    listingId: string;
    creatorUserId: string;
    pitch: string;
    addedToCrm: boolean;
  }) {
    const application = {
      id: `${input.creatorUserId}-app-${this.applications.length + 1}`,
      listingId: input.listingId,
      pitch: input.pitch,
      appliedAt: new Date().toISOString(),
      addedToCrm: input.addedToCrm,
      status: 'pending' as const,
      creatorUserId: input.creatorUserId,
      creatorName: 'Creator',
      creatorEmail: 'creator@example.com',
    };
    this.applications.push(application);
    if (input.addedToCrm) {
      await this.linkCrm(input.creatorUserId, input.listingId);
    }
    return {
      id: application.id,
      listingId: application.listingId,
      pitch: application.pitch,
      appliedAt: application.appliedAt,
      addedToCrm: application.addedToCrm,
      status: application.status,
    };
  }

  async getApplicationById(applicationId: string) {
    const application = this.applications.find((app) => app.id === applicationId);
    if (!application) return null;
    return {
      id: application.id,
      listingId: application.listingId,
      pitch: application.pitch,
      appliedAt: application.appliedAt,
      addedToCrm: application.addedToCrm,
      status: application.status ?? 'pending',
      creatorUserId: application.creatorUserId,
      creatorEmail: application.creatorEmail || 'creator@example.com',
      creatorName: application.creatorName || 'Creator',
    };
  }

  async updateApplicationStatus(
    applicationId: string,
    status: 'accepted' | 'rejected',
  ) {
    const application = this.applications.find((app) => app.id === applicationId);
    if (!application || (application.status ?? 'pending') !== 'pending') {
      return null;
    }
    application.status = status;
    return {
      id: application.id,
      listingId: application.listingId,
      pitch: application.pitch,
      appliedAt: application.appliedAt,
      addedToCrm: application.addedToCrm,
      status,
    };
  }

  async linkCrm(creatorUserId: string, listingId: string) {
    this.crmLinks.add(`${creatorUserId}:${listingId}`);
  }
}

describe('MarketplaceService', () => {
  let repository: FakeMarketplaceRepository;
  let inbox: { notifySelf: jest.Mock };
  let invites: { acceptMarketplaceApplicant: jest.Mock };
  let service: MarketplaceService;

  beforeEach(() => {
    repository = new FakeMarketplaceRepository();
    inbox = {
      notifySelf: jest.fn().mockResolvedValue({}),
    };
    invites = {
      acceptMarketplaceApplicant: jest.fn().mockResolvedValue({}),
    };
    const creatorCrm = {
      addListingToPipeline: jest.fn().mockResolvedValue(undefined),
    };
    service = new MarketplaceService(
      repository,
      creatorCrm as never,
      inbox as never,
      invites as never,
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
    expect(repository.listings[0]?.applicationDeadline).toBe(campaign.endDate);

    await service.syncFromCampaign('brand-1', {
      ...campaign,
      postToMarketplace: false,
    });
    expect(repository.listings).toHaveLength(0);
  });

  it('keeps marketplace listing when campaign is paused or completed', async () => {
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
      status: 'paused',
    });
    expect(repository.listings).toHaveLength(1);
    expect(repository.listings[0]?.status).toBe('closed');

    await service.syncFromCampaign('brand-1', {
      ...campaign,
      status: 'completed',
    });
    expect(repository.listings).toHaveLength(1);
    expect(repository.listings[0]?.status).toBe('closed');
  });

  it('notifies the brand inbox when a campaign first goes live', async () => {
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
    expect(inbox.notifySelf).toHaveBeenCalledWith(
      'brand-1',
      expect.objectContaining({
        type: 'campaign_update',
        title: 'Campaign published to marketplace',
        href: '/app/marketplace',
        campaignId: campaign.id,
      }),
    );

    inbox.notifySelf.mockClear();
    await service.syncFromCampaign('brand-1', campaign);
    expect(inbox.notifySelf).not.toHaveBeenCalled();
  });

  it('hides closed listings from creator marketplace browse', async () => {
    repository.user = {
      id: 'creator-1',
      role: 'creator',
      fullName: 'Creator',
      companyName: null,
    };
    repository.listings = [
      {
        id: 'open-1',
        name: 'Open campaign',
        brandName: 'Acme',
        ownerUserId: 'brand-1',
        campaignId: 'campaign-open',
        campaignType: 'experience',
        type: 'tiktok',
        status: 'open',
        startDate: '2026-07-01',
        endDate: '2026-09-01',
        applicationDeadline: '2026-09-01',
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
      {
        id: 'closed-1',
        name: 'Paused campaign',
        brandName: 'Acme',
        ownerUserId: 'brand-1',
        campaignId: 'campaign-closed',
        campaignType: 'community',
        type: 'mixed_bundle',
        status: 'closed',
        startDate: '2026-07-01',
        endDate: '2026-09-01',
        applicationDeadline: '2026-09-01',
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

    const result = await service.getMarketplace('creator-1');
    expect(result.listings.map((listing) => listing.id)).toEqual(['open-1']);
  });

  it('lets creators apply once and notifies the brand', async () => {
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
    expect(inbox.notifySelf).toHaveBeenCalledWith(
      'brand-1',
      expect.objectContaining({
        type: 'application_received',
        href: '/app/marketplace/listing-1',
      }),
    );

    await expect(
      service.apply('creator-1', 'listing-1', 'Again', false),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists applicants for listing owners', async () => {
    repository.user = {
      id: 'brand-1',
      role: 'brand',
      fullName: 'Brand',
      companyName: 'Acme',
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
        applicantsCount: 1,
        postedAt: new Date().toISOString(),
      },
    ];
    repository.applications = [
      {
        id: 'app-1',
        listingId: 'listing-1',
        pitch: 'Hello pitch',
        appliedAt: new Date().toISOString(),
        addedToCrm: true,
        status: 'pending',
        creatorUserId: 'creator-1',
        creatorName: 'Alex',
        creatorEmail: 'alex@example.com',
      },
    ];

    await expect(
      service.listListingApplications('brand-1', 'listing-1'),
    ).resolves.toEqual({
      applications: [
        expect.objectContaining({
          pitch: 'Hello pitch',
          creatorName: 'Alex',
          creatorEmail: 'alex@example.com',
          status: 'pending',
        }),
      ],
    });
  });

  it('lets brands accept or reject applications and notifies the creator', async () => {
    repository.user = {
      id: 'brand-1',
      role: 'brand',
      fullName: 'Brand',
      companyName: 'Acme',
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
        applicantsCount: 1,
        postedAt: new Date().toISOString(),
      },
    ];
    repository.applications = [
      {
        id: 'app-1',
        listingId: 'listing-1',
        pitch: 'Hello pitch',
        appliedAt: new Date().toISOString(),
        addedToCrm: true,
        status: 'pending',
        creatorUserId: 'creator-1',
        creatorName: 'Alex',
        creatorEmail: 'alex@example.com',
      },
    ];

    await expect(
      service.respondToApplication('brand-1', 'listing-1', 'app-1', 'accepted'),
    ).resolves.toEqual({
      application: expect.objectContaining({
        id: 'app-1',
        status: 'accepted',
      }),
    });
    expect(inbox.notifySelf).toHaveBeenCalledWith(
      'creator-1',
      expect.objectContaining({
        type: 'application_status',
        title: 'Application accepted: Summer',
        href: '/app/marketplace/listing-1',
      }),
    );
    expect(invites.acceptMarketplaceApplicant).toHaveBeenCalledWith({
      brandUserId: 'brand-1',
      campaignId: 'campaign-1',
      campaignName: 'Summer',
      brandName: 'Acme',
      creatorUserId: 'creator-1',
      creatorEmail: 'alex@example.com',
      creatorName: 'Alex',
    });

    await expect(
      service.respondToApplication('brand-1', 'listing-1', 'app-1', 'rejected'),
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
