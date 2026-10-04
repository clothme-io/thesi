import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CREATORS_DIRECTORY_REPOSITORY,
  type CreatorDirectoryProfile,
  type CreatorsDirectoryRepository,
} from 'src/api/creators/creators-directory.repository';
import { EmailService } from 'src/shared/email/email.service';
import { AnalyticsService } from 'src/shared/analytics/analytics.service';
import type { MarketplaceListingRecord } from '../marketplace/marketplace.repository';
import type { CampaignRecord } from './campaign.repository';

const BATCH_SIZE = 10;

@Injectable()
export class CampaignPublicationNotifier {
  private readonly logger = new Logger(CampaignPublicationNotifier.name);
  private readonly webUrl: string;

  constructor(
    @Inject(CREATORS_DIRECTORY_REPOSITORY)
    private readonly creators: CreatorsDirectoryRepository,
    private readonly email: EmailService,
    private readonly config: ConfigService,
    private readonly analytics: AnalyticsService,
  ) {
    this.webUrl = this.config
      .getOrThrow<string>('THESI_WEB_URL')
      .replace(/\/+$/, '');
  }

  async notifyCreatorsOfPublishedCampaign(
    campaign: CampaignRecord,
    listing: MarketplaceListingRecord,
  ): Promise<void> {
    if (campaign.status !== 'active' || !campaign.postToMarketplace) {
      return;
    }

    const creators = await this.creators.listCreators();
    const recipients = creators.filter((creator) =>
      this.matchesCampaign(creator, campaign),
    );
    const listingUrl = `${this.webUrl}/app/marketplace/${listing.id}`;

    for (let index = 0; index < recipients.length; index += BATCH_SIZE) {
      const batch = recipients.slice(index, index + BATCH_SIZE);
      await Promise.all(
        batch.map((creator) =>
          this.sendToCreator(creator, campaign, listing, listingUrl),
        ),
      );
    }
  }

  private async sendToCreator(
    creator: CreatorDirectoryProfile,
    campaign: CampaignRecord,
    listing: MarketplaceListingRecord,
    listingUrl: string,
  ): Promise<void> {
    try {
      await this.email.sendCampaignPublishedToCreator({
        to: creator.email,
        creatorName: creator.name,
        campaignName: campaign.name,
        brandName: listing.brandName,
        description: campaign.description || campaign.brief,
        contentTypes: campaign.contentTypes,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
        paymentSummary: summarizePayment(campaign.payment),
        listingUrl,
      });
      this.analytics.track('campaign_publication_email_sent', creator.id, {
        campaign_id: campaign.id,
        listing_id: listing.id,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown email error';
      this.logger.warn(
        `Failed to send campaign publication email for campaign ${campaign.id} to creator ${creator.id}: ${message}`,
      );
      this.analytics.track('campaign_publication_email_failed', creator.id, {
        campaign_id: campaign.id,
        listing_id: listing.id,
        failure_reason: message,
      });
    }
  }

  private matchesCampaign(
    creator: CreatorDirectoryProfile,
    campaign: CampaignRecord,
  ): boolean {
    const requirements = campaign.requirements;
    if (
      requirements.niches.length > 0 &&
      !hasOverlap(requirements.niches, creator.niches)
    ) {
      return false;
    }
    if (
      requirements.platforms.length > 0 &&
      !hasOverlap(requirements.platforms, creator.platforms)
    ) {
      return false;
    }
    if (
      requirements.location &&
      !locationMatches(requirements.location, creator.location)
    ) {
      return false;
    }
    const minimumFollowers = parseFollowerFloor(requirements.minFollowersRange);
    if (
      minimumFollowers > 0 &&
      creator.stats.totalFollowers > 0 &&
      creator.stats.totalFollowers < minimumFollowers
    ) {
      return false;
    }
    return Boolean(creator.email);
  }
}

function hasOverlap(left: string[], right: string[]): boolean {
  const normalizedRight = new Set(right.map(normalizeToken).filter(Boolean));
  return left
    .map(normalizeToken)
    .filter(Boolean)
    .some((value) => normalizedRight.has(value));
}

function locationMatches(requirement: string, creatorLocation: string): boolean {
  const creator = normalizeLocation(creatorLocation);
  if (!creator) return false;
  return requirement
    .split(',')
    .map(normalizeLocation)
    .filter(Boolean)
    .some((value) => creator.includes(value) || value.includes(creator));
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

function normalizeLocation(value: string): string {
  const normalized = normalizeToken(value);
  if (['us', 'usa', 'u.s.', 'u.s.a.', 'united states'].includes(normalized)) {
    return 'united states';
  }
  if (['ca', 'can'].includes(normalized)) {
    return 'canada';
  }
  return normalized;
}

function parseFollowerFloor(value: string): number {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return 0;
  const match = normalized.match(/(\d+(?:\.\d+)?)\s*([km])?/);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;
  const suffix = match[2];
  if (suffix === 'm') return Math.floor(amount * 1_000_000);
  if (suffix === 'k') return Math.floor(amount * 1_000);
  return Math.floor(amount);
}

function summarizePayment(payment: CampaignRecord['payment']): string {
  if (payment.model === 'flat_rate') {
    return payment.flatRateCents
      ? `${formatMoney(payment.flatRateCents)} flat rate`
      : 'Flat rate';
  }
  if (payment.model === 'royalty') {
    return payment.royaltyPercent
      ? `${payment.royaltyPercent}% royalty`
      : 'Royalty';
  }
  if (payment.model === 'hybrid') {
    const base = payment.hybrid?.base?.amountCents
      ? formatMoney(payment.hybrid.base.amountCents)
      : null;
    const reward = payment.hybrid?.affiliate?.enabled
      ? 'creator reward pool'
      : null;
    return [base, reward].filter(Boolean).join(' + ') || 'Hybrid';
  }
  if (payment.model === 'commission') {
    const base = payment.hybrid?.base?.amountCents
      ? formatMoney(payment.hybrid.base.amountCents)
      : null;
    const commission = payment.hybrid?.affiliate?.commissionPercent
      ? `${payment.hybrid.affiliate.commissionPercent}% commission`
      : 'commission';
    return [base, commission].filter(Boolean).join(' + ');
  }
  return 'Payment details available in Thesi';
}

function formatMoney(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
