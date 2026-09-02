import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreatorCrmService } from 'src/api/creator-crm/creator-crm.service';
import { InboxService } from 'src/api/inbox/inbox.service';
import { InvitesService } from 'src/api/invites/invites.service';
import { NovuService } from 'src/shared/novu/novu.service';
import type { CampaignRecord } from '../campaigns/campaign.repository';
import {
  MARKETPLACE_REPOSITORY,
  type MarketplaceApplicationRecord,
  type MarketplaceBrandApplicationRecord,
  type MarketplaceCampaignSync,
  type MarketplaceListingRecord,
  type MarketplaceRepository,
  type MarketplaceUser,
} from './marketplace.repository';

@Injectable()
export class MarketplaceService implements MarketplaceCampaignSync {
  private readonly logger = new Logger(MarketplaceService.name);

  constructor(
    @Inject(MARKETPLACE_REPOSITORY)
    private readonly marketplace: MarketplaceRepository,
    private readonly creatorCrm: CreatorCrmService,
    private readonly inbox: InboxService,
    private readonly invites: InvitesService,
    private readonly novu: NovuService,
  ) {}

  async syncFromCampaign(
    ownerUserId: string,
    campaign: CampaignRecord,
  ): Promise<void> {
    // True unpublish (or never posted): remove listing.
    if (!campaign.postToMarketplace) {
      await this.marketplace.deleteListingByCampaignId(campaign.id);
      return;
    }
    // Draft campaigns are not marketplace-visible yet.
    if (campaign.status === 'draft') {
      await this.marketplace.deleteListingByCampaignId(campaign.id);
      return;
    }
    // Active / paused / completed: upsert so applicants are preserved when
    // paused or completed (listing status resolves to closed).
    const existing = (await this.marketplace.listByOwner(ownerUserId)).find(
      (listing) => listing.campaignId === campaign.id,
    );
    const wasBrowsable = Boolean(existing && existing.status !== 'closed');
    const brandName =
      (await this.marketplace.getBrandDisplayName(ownerUserId)) || 'Your Brand';
    await this.marketplace.upsertListingFromCampaign({
      ownerUserId,
      brandName,
      campaign,
    });

    const nowBrowsable =
      campaign.postToMarketplace && campaign.status === 'active';
    if (nowBrowsable && !wasBrowsable) {
      await this.inbox.notifySelf(ownerUserId, {
        type: 'campaign_update',
        title: 'Campaign published to marketplace',
        body: `"${campaign.name}" is now live on the marketplace for creators to browse and apply.`,
        href: '/app/marketplace',
        campaignId: campaign.id,
        audience: 'brand',
      });
    }
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
      return {
        listings: listings.filter(
          (listing) => !this.isClosedForApplications(listing),
        ),
        applications,
        crmLinkedListingIds,
      };
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

  async listListingApplications(
    userId: string,
    listingId: string,
  ): Promise<{ applications: MarketplaceBrandApplicationRecord[] }> {
    const user = await this.requireUser(userId);
    if (user.role !== 'brand') {
      throw new ForbiddenException('Brand account required');
    }
    const listing = await this.marketplace.getById(listingId);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.ownerUserId !== userId) {
      throw new ForbiddenException(
        'You can only view applicants for your listings',
      );
    }
    const applications =
      await this.marketplace.listApplicationsForListing(listingId);
    return { applications };
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
    if (this.isClosedForApplications(listing)) {
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

    await this.inbox.notifySelf(listing.ownerUserId, {
      type: 'application_received',
      title: `New application: ${listing.name}`,
      body: `${user.fullName} applied to "${listing.name}". Open the listing to review their pitch.`,
      href: `/app/marketplace/${listing.id}`,
      campaignId: listing.campaignId,
      audience: 'brand',
    });

    if (user.email) {
      await this.novu
        .trigger({
          type: 'marketplace_application_received',
          toEmail: user.email,
          subscriberId: user.id,
          creatorName: user.fullName,
          brandName: listing.brandName,
          campaignTitle: listing.name,
          listingId: listing.id,
          applicationId: application.id,
        })
        .catch((error) =>
          this.logger.warn(
            `Novu marketplace application confirmation failed for ${application.id}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          ),
        );
    }

    const crmLinkedListingIds = await this.marketplace.listCrmLinkedListingIds(
      user.id,
    );
    return { application, crmLinkedListingIds };
  }

  async respondToApplication(
    userId: string,
    listingId: string,
    applicationId: string,
    decision: 'accepted' | 'rejected',
  ): Promise<{ application: MarketplaceApplicationRecord }> {
    const user = await this.requireUser(userId);
    if (user.role !== 'brand') {
      throw new ForbiddenException('Brand account required');
    }
    if (decision !== 'accepted' && decision !== 'rejected') {
      throw new BadRequestException('decision must be accepted or rejected');
    }

    const listing = await this.marketplace.getById(listingId);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }
    if (listing.ownerUserId !== userId) {
      throw new ForbiddenException(
        'You can only respond to applications on your listings',
      );
    }

    const existing = await this.marketplace.getApplicationById(applicationId);
    if (!existing || existing.listingId !== listingId) {
      throw new NotFoundException('Application not found');
    }
    if (existing.status !== 'pending') {
      throw new ConflictException(`Application already ${existing.status}`);
    }

    const application = await this.marketplace.updateApplicationStatus(
      applicationId,
      decision,
    );
    if (!application) {
      throw new ConflictException('Application already responded to');
    }

    const verb = decision === 'accepted' ? 'accepted' : 'rejected';
    await this.inbox.notifySelf(existing.creatorUserId, {
      type: 'application_status',
      title: `Application ${verb}: ${listing.name}`,
      body: `${listing.brandName} ${verb} your application to "${listing.name}".`,
      href: `/app/marketplace/${listing.id}`,
      campaignId: listing.campaignId,
      audience: 'creator',
    });

    await this.novu
      .trigger({
        type: 'marketplace_application_status',
        toEmail: existing.creatorEmail,
        subscriberId: existing.creatorUserId,
        creatorName: existing.creatorName,
        campaignTitle: listing.name,
        status: decision,
        message:
          decision === 'accepted'
            ? `${listing.brandName} accepted your application.`
            : `${listing.brandName} declined your application.`,
        listingId: listing.id,
        applicationId: application.id,
      })
      .catch((error) =>
        this.logger.warn(
          `Novu marketplace application status failed for ${application.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        ),
      );

    if (decision === 'accepted') {
      await this.invites.acceptMarketplaceApplicant({
        brandUserId: userId,
        campaignId: listing.campaignId,
        campaignName: listing.name,
        brandName: listing.brandName,
        creatorUserId: existing.creatorUserId,
        creatorEmail: existing.creatorEmail,
        creatorName: existing.creatorName,
      });
    }

    return { application };
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

  private isClosedForApplications(listing: MarketplaceListingRecord): boolean {
    if (listing.status === 'closed') return true;
    const today = new Date().toISOString().slice(0, 10);
    return Boolean(
      listing.applicationDeadline && listing.applicationDeadline < today,
    );
  }
}
