import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatorCrmService } from 'src/api/creator-crm/creator-crm.service';
import type { CampaignRecord } from '../campaigns/campaign.repository';
import {
  MARKETPLACE_REPOSITORY,
  type MarketplaceApplicationRecord,
  type MarketplaceCampaignSync,
  type MarketplaceListingRecord,
  type MarketplaceRepository,
  type MarketplaceUser,
} from './marketplace.repository';

@Injectable()
export class MarketplaceService implements MarketplaceCampaignSync {
  constructor(
    @Inject(MARKETPLACE_REPOSITORY)
    private readonly marketplace: MarketplaceRepository,
    private readonly creatorCrm: CreatorCrmService,
  ) {}

  async syncFromCampaign(
    ownerUserId: string,
    campaign: CampaignRecord,
  ): Promise<void> {
    if (!campaign.postToMarketplace || campaign.status !== 'active') {
      await this.marketplace.deleteListingByCampaignId(campaign.id);
      return;
    }
    const brandName =
      (await this.marketplace.getBrandDisplayName(ownerUserId)) || 'Your Brand';
    await this.marketplace.upsertListingFromCampaign({
      ownerUserId,
      brandName,
      campaign,
    });
  }

  async getMarketplace(userId: string): Promise<{
    listings: MarketplaceListingRecord[];
    applications: MarketplaceApplicationRecord[];
    crmLinkedListingIds: string[];
  }> {
    const user = await this.requireUser(userId);
    if (user.role === 'brand') {
      return {
        listings: await this.marketplace.listByOwner(userId),
        applications: [],
        crmLinkedListingIds: [],
      };
    }
    if (user.role === 'creator') {
      const [listings, applications, crmLinkedListingIds] = await Promise.all([
        this.marketplace.listAll(),
        this.marketplace.listApplicationsForCreator(userId),
        this.marketplace.listCrmLinkedListingIds(userId),
      ]);
      return { listings, applications, crmLinkedListingIds };
    }
    throw new ForbiddenException('Marketplace access required');
  }

  async getListing(
    userId: string,
    listingId: string,
  ): Promise<MarketplaceListingRecord> {
    await this.requireUser(userId);
    const listing = await this.marketplace.getById(listingId);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    return listing;
  }

  async apply(
    userId: string,
    listingId: string,
    pitch: string,
    addToCrm: boolean,
  ): Promise<{
    application: MarketplaceApplicationRecord;
    crmLinkedListingIds: string[];
  }> {
    const user = await this.requireCreator(userId);
    const listing = await this.marketplace.getById(listingId);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.status === 'closed') {
      throw new BadRequestException('This listing is closed');
    }
    const trimmed = pitch.trim();
    if (!trimmed) {
      throw new BadRequestException('pitch is required');
    }
    if (await this.marketplace.hasApplied(listingId, user.id)) {
      throw new ConflictException('You already applied to this listing');
    }
    const application = await this.marketplace.createApplication({
      listingId,
      creatorUserId: user.id,
      pitch: trimmed,
      addedToCrm: addToCrm,
    });
    if (addToCrm) {
      await this.creatorCrm.addListingToPipeline(user.id, listingId);
    }
    const crmLinkedListingIds =
      await this.marketplace.listCrmLinkedListingIds(user.id);
    return { application, crmLinkedListingIds };
  }

  async linkToCrm(
    userId: string,
    listingId: string,
  ): Promise<{ crmLinkedListingIds: string[] }> {
    await this.requireCreator(userId);
    const listing = await this.marketplace.getById(listingId);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    await this.marketplace.linkCrm(userId, listingId);
    await this.creatorCrm.addListingToPipeline(userId, listingId);
    return {
      crmLinkedListingIds:
        await this.marketplace.listCrmLinkedListingIds(userId),
    };
  }

  private async requireUser(userId: string): Promise<MarketplaceUser> {
    const user = await this.marketplace.getUser(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    return user;
  }

  private async requireCreator(userId: string): Promise<MarketplaceUser> {
    const user = await this.requireUser(userId);
    if (user.role !== 'creator') {
      throw new ForbiddenException('Creator account required');
    }
    return user;
  }
}
