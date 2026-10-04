import type { ConfigService } from '@nestjs/config';
import type {
  CreatorDirectoryProfile,
  CreatorsDirectoryRepository,
} from 'src/api/creators/creators-directory.repository';
import type { EmailService } from 'src/shared/email/email.service';
import type { AnalyticsService } from 'src/shared/analytics/analytics.service';
import { CampaignPublicationNotifier } from './campaign-publication-notifier.service';
import type { CampaignRecord } from './campaign.repository';
import type { MarketplaceListingRecord } from '../marketplace/marketplace.repository';

describe('CampaignPublicationNotifier', () => {
  let creators: { listCreators: jest.Mock };
  let email: { sendCampaignPublishedToCreator: jest.Mock };
  let analytics: { track: jest.Mock };
  let notifier: CampaignPublicationNotifier;

  beforeEach(() => {
    creators = { listCreators: jest.fn() };
    email = { sendCampaignPublishedToCreator: jest.fn().mockResolvedValue(undefined) };
    analytics = { track: jest.fn() };
    notifier = new CampaignPublicationNotifier(
      creators as unknown as CreatorsDirectoryRepository,
      email as unknown as EmailService,
      {
        getOrThrow: jest.fn().mockReturnValue('https://app.get-thesi.test/'),
      } as unknown as ConfigService,
      analytics as unknown as AnalyticsService,
    );
  });

  it('emails creators who match published marketplace campaign criteria', async () => {
    creators.listCreators.mockResolvedValue([
      creatorProfile({
        id: 'creator-match',
        email: 'match@example.com',
        niches: ['Fitness'],
        location: 'US',
        platforms: ['TikTok'],
        totalFollowers: 12_000,
      }),
      creatorProfile({
        id: 'creator-skip',
        email: 'skip@example.com',
        niches: ['Food'],
        location: 'US',
        platforms: ['TikTok'],
        totalFollowers: 12_000,
      }),
    ]);

    await notifier.notifyCreatorsOfPublishedCampaign(
      campaignRecord(),
      marketplaceListing(),
    );

    expect(email.sendCampaignPublishedToCreator).toHaveBeenCalledTimes(1);
    expect(email.sendCampaignPublishedToCreator).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'match@example.com',
        creatorName: 'Creator Match',
        campaignName: 'Launch Campaign',
        brandName: 'Acme',
        listingUrl: 'https://app.get-thesi.test/app/marketplace/listing-1',
      }),
    );
    expect(analytics.track).toHaveBeenCalledWith(
      'campaign_publication_email_sent',
      'creator-match',
      expect.objectContaining({
        campaign_id: 'campaign-1',
        listing_id: 'listing-1',
      }),
    );
  });

  it('does not email for draft or private campaigns', async () => {
    creators.listCreators.mockResolvedValue([creatorProfile()]);

    await notifier.notifyCreatorsOfPublishedCampaign(
      campaignRecord({ status: 'draft' }),
      marketplaceListing(),
    );
    await notifier.notifyCreatorsOfPublishedCampaign(
      campaignRecord({ postToMarketplace: false }),
      marketplaceListing(),
    );

    expect(creators.listCreators).not.toHaveBeenCalled();
    expect(email.sendCampaignPublishedToCreator).not.toHaveBeenCalled();
  });

  it('logs analytics failures without throwing publish flow errors', async () => {
    creators.listCreators.mockResolvedValue([creatorProfile()]);
    email.sendCampaignPublishedToCreator.mockRejectedValueOnce(
      new Error('Resend unavailable'),
    );

    await expect(
      notifier.notifyCreatorsOfPublishedCampaign(
        campaignRecord(),
        marketplaceListing(),
      ),
    ).resolves.toBeUndefined();

    expect(analytics.track).toHaveBeenCalledWith(
      'campaign_publication_email_failed',
      'creator-1',
      expect.objectContaining({
        failure_reason: 'Resend unavailable',
      }),
    );
  });
});

function campaignRecord(
  overrides: Partial<CampaignRecord> = {},
): CampaignRecord {
  return {
    id: 'campaign-1',
    name: 'Launch Campaign',
    description: 'A short launch campaign.',
    campaignType: 'growth',
    contentTypes: ['tiktok'],
    status: 'active',
    startDate: '2026-10-03',
    endDate: '2026-11-03',
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
    payment: { model: 'flat_rate', flatRateCents: 25_000 },
    requiredTasks: [],
    creatorBenefits: {
      productsKept: false,
      bonusEligibility: false,
      creatorPoolEligibility: false,
      foundingCreatorRecognition: false,
      portfolioUse: false,
      priorityFutureCampaigns: false,
      brandOpportunityAccess: false,
      customBenefits: [],
    },
    contentRights: {
      organicUsage: true,
      websiteAppUsage: false,
      paidAdsUsage: false,
      duration: '',
      rawContentAccess: false,
    },
    productsProvided: [],
    creatorDisclosureEnabled: false,
    postToMarketplace: true,
    createdAt: '2026-10-03T00:00:00.000Z',
    updatedAt: '2026-10-03T00:00:00.000Z',
    ...overrides,
  };
}

function marketplaceListing(): MarketplaceListingRecord {
  return {
    id: 'listing-1',
    name: 'Launch Campaign',
    brandName: 'Acme',
    ownerUserId: 'brand-1',
    campaignId: 'campaign-1',
  } as MarketplaceListingRecord;
}

function creatorProfile(
  overrides: Partial<CreatorDirectoryProfile> & { totalFollowers?: number } = {},
): CreatorDirectoryProfile {
  const totalFollowers = overrides.totalFollowers ?? 10_000;
  return {
    id: 'creator-1',
    name: 'Creator Match',
    email: 'creator@example.com',
    niches: ['Fitness'],
    location: 'United States',
    platforms: ['TikTok'],
    followerRange: '10k+',
    bio: '',
    statsSyncedAt: null,
    stats: {
      totalFollowers,
      avgViews: 0,
      avgEngagementRate: 0,
      completedCampaigns: 0,
      responseRate: 0,
      platforms: [],
    },
    ugcPosts: [],
    ...overrides,
  };
}
