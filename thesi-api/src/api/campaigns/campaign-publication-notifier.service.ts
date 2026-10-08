import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CREATORS_DIRECTORY_REPOSITORY,
  type CreatorNotificationRecipient,
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

    const recipients = uniqueRecipients(
      await this.creators.listActiveCreatorRecipients(),
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
    creator: CreatorNotificationRecipient,
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
}

function uniqueRecipients(
  creators: CreatorNotificationRecipient[],
): CreatorNotificationRecipient[] {
  const seen = new Set<string>();
  const recipients: CreatorNotificationRecipient[] = [];
  for (const creator of creators) {
    const email = creator.email.trim();
    const key = email.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    recipients.push({ ...creator, email });
  }
  return recipients;
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
  if (
    payment.model === 'commission' ||
    payment.model === 'product_commission' ||
    payment.model === 'app_install'
  ) {
    const base = payment.hybrid?.base?.amountCents
      ? formatMoney(payment.hybrid.base.amountCents)
      : null;
    const commission = payment.hybrid?.affiliate?.commissionPercent
      ? `${payment.hybrid.affiliate.commissionPercent}% commission`
      : payment.model === 'app_install' ||
          payment.hybrid?.affiliate?.commissionType === 'fixed_amount_per_install'
        ? 'app install'
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
