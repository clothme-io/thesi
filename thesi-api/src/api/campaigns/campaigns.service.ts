import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BillingService } from 'src/api/billing/billing.service';
import { ConnectService } from 'src/api/connect/connect.service';
import {
  campaignPayoutCents,
  previewPlatformFee,
  type CampaignPaymentForFee,
} from 'src/shared/platform-fee/platform-fee.util';
import { sanitizeFileName } from 'src/shared/storage/file-helpers';
import {
  FILE_STORAGE,
  type FileStoragePort,
  type UploadableFile,
} from 'src/shared/storage/file-storage.port';
import { StripeService } from 'src/shared/stripe/stripe.service';
import {
  MARKETPLACE_CAMPAIGN_SYNC,
  type MarketplaceCampaignSync,
} from '../marketplace/marketplace.repository';
import {
  INVITES_REPOSITORY,
  type InvitesRepository,
} from '../invites/invites.repository';
import { toFileMeta } from './campaign-file.mapper';
import type {
  CampaignPaymentDto,
  UpsertCampaignDto,
} from './dto/campaign.dto';
import {
  CAMPAIGN_REPOSITORY,
  type CampaignFileMeta,
  type CampaignPlatformFeeRecord,
  type CampaignRecord,
  type CampaignRepository,
  type CampaignUser,
  type CreatorPayoutRecord,
} from './campaign.repository';

const MAX_FILE_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_PREFIXES = [
  'image/',
  'application/pdf',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument',
];

@Injectable()
export class CampaignsService {
  constructor(
    @Inject(CAMPAIGN_REPOSITORY)
    private readonly campaigns: CampaignRepository,
    @Inject(FILE_STORAGE)
    private readonly storage: FileStoragePort,
    private readonly billing: BillingService,
    private readonly stripe: StripeService,
    private readonly connect: ConnectService,
    @Inject(INVITES_REPOSITORY)
    private readonly invites: InvitesRepository,
    @Optional()
    @Inject(MARKETPLACE_CAMPAIGN_SYNC)
    private readonly marketplaceSync?: MarketplaceCampaignSync,
  ) {}

  async list(userId: string): Promise<{ campaigns: CampaignRecord[] }> {
    await this.requireBrand(userId);
    const campaigns = await this.campaigns.listByOwner(userId);
    return { campaigns };
  }

  async get(userId: string, campaignId: string): Promise<CampaignRecord> {
    await this.requireBrand(userId);
    const campaign = await this.campaigns.getByIdForOwner(userId, campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return campaign;
  }

  previewPlatformFee(payment: CampaignPaymentDto) {
    return previewPlatformFee(payment as CampaignPaymentForFee);
  }

  async getPlatformFee(
    userId: string,
    campaignId: string,
  ): Promise<CampaignPlatformFeeRecord | null> {
    await this.requireBrand(userId);
    const campaign = await this.campaigns.getByIdForOwner(userId, campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    return this.campaigns.getPlatformFee(campaignId);
  }

  async create(
    userId: string,
    dto: UpsertCampaignDto,
  ): Promise<CampaignRecord> {
    await this.requireBrand(userId);
    this.assertPublishReady(dto);
    const input = this.normalizeCampaignInput(dto);
    this.assertDateRange(input);
    const needsFee = this.requiresPlatformFee(input);
    const createDto = needsFee
      ? { ...input, status: 'draft' as const, postToMarketplace: false }
      : input;
    let campaign = await this.campaigns.create(userId, createDto);
    if (needsFee) {
      try {
        await this.collectPlatformFee(userId, campaign);
        campaign =
          (await this.campaigns.update(userId, campaign.id, input)) ??
          campaign;
      } catch (error) {
        throw error;
      }
    }
    await this.marketplaceSync?.syncFromCampaign(userId, campaign);
    return campaign;
  }

  async update(
    userId: string,
    campaignId: string,
    dto: UpsertCampaignDto,
  ): Promise<CampaignRecord> {
    await this.requireBrand(userId);
    const existing = await this.campaigns.getByIdForOwner(userId, campaignId);
    if (!existing) {
      throw new NotFoundException('Campaign not found');
    }
    this.assertPublishReady(dto, existing);
    const input = this.normalizeCampaignInput(dto, existing);
    this.assertDateRange(input);

    if (this.requiresPlatformFee(input)) {
      await this.collectPlatformFee(userId, {
        ...existing,
        payment: input.payment,
        name: input.name,
      });
    }

    const campaign = await this.campaigns.update(userId, campaignId, input);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    await this.marketplaceSync?.syncFromCampaign(userId, campaign);
    return campaign;
  }

  async payPlatformFee(
    userId: string,
    campaignId: string,
  ): Promise<{
    campaign: CampaignRecord;
    fee: CampaignPlatformFeeRecord;
  }> {
    await this.requireBrand(userId);
    const campaign = await this.campaigns.getByIdForOwner(userId, campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    const fee = await this.collectPlatformFee(userId, campaign);
    return { campaign, fee };
  }

  async listCreatorPayouts(
    userId: string,
    campaignId: string,
  ): Promise<{ payouts: CreatorPayoutRecord[] }> {
    await this.requireBrand(userId);
    const campaign = await this.campaigns.getByIdForOwner(userId, campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }
    const payouts =
      await this.campaigns.listCreatorPayoutsForCampaign(campaignId);
    return { payouts };
  }

  async payCreator(
    userId: string,
    campaignId: string,
    input: { creatorUserId: string; amountCents?: number },
  ): Promise<CreatorPayoutRecord> {
    await this.requireBrand(userId);
    const campaign = await this.campaigns.getByIdForOwner(userId, campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const creatorUserId = input.creatorUserId.trim();
    const existing = await this.campaigns.getCreatorPayout(
      campaignId,
      creatorUserId,
    );
    if (existing?.status === 'transferred') {
      return existing;
    }

    const invites = await this.invites.listCampaignInvites(userId, campaignId);
    const invite = invites.find(
      (item) => item.creatorId === creatorUserId && !item.external,
    );
    if (!invite) {
      throw new BadRequestException(
        'Invite this creator to the campaign before paying them',
      );
    }
    if (invite.status !== 'accepted') {
      throw new BadRequestException(
        'Creator must accept the campaign invite before they can be paid',
      );
    }

    const readiness =
      await this.connect.getCreatorPayoutReadiness(creatorUserId);
    if (!readiness.ready || !readiness.accountId) {
      throw new BadRequestException(
        readiness.reason ||
          'Creator must finish Stripe payout setup before receiving funds',
      );
    }

    const defaultAmount = campaignPayoutCents(
      campaign.payment as CampaignPaymentForFee,
    );
    const amountCents = input.amountCents ?? defaultAmount;
    if (amountCents <= 0) {
      throw new BadRequestException(
        'Payout amount must be greater than zero',
      );
    }

    const chargeContext = await this.billing.resolveChargeContext(userId);
    if (!chargeContext) {
      throw new BadRequestException(
        'Add a default payment method in Settings → Payment methods before paying a creator.',
      );
    }

    const idempotencyKey = `creator-payout:${campaignId}:${creatorUserId}`;
    let paymentIntentId = existing?.stripePaymentIntentId ?? null;

    try {
      if (existing?.status !== 'charged' || !paymentIntentId) {
        const charge = await this.stripe.chargeOffSession({
          customerId: chargeContext.customerId,
          paymentMethodId: chargeContext.paymentMethodId,
          amountCents,
          description: `Creator payout — ${campaign.name}`,
          idempotencyKey: `creator-payout-charge:${campaignId}:${creatorUserId}`,
          metadata: {
            campaignId,
            creatorUserId,
            brandUserId: userId,
            type: 'creator_payout',
          },
        });
        paymentIntentId = charge.paymentIntentId;
        await this.campaigns.upsertCreatorPayout({
          campaignId,
          brandUserId: userId,
          creatorUserId,
          amountCents,
          status: 'charged',
          stripePaymentIntentId: paymentIntentId,
          stripeTransferId: null,
          stripeDestinationAccountId: readiness.accountId,
          idempotencyKey,
          failureReason: null,
        });
      }

      const transfer = await this.stripe.createTransfer({
        amountCents,
        destinationAccountId: readiness.accountId,
        idempotencyKey: `creator-payout-transfer:${campaignId}:${creatorUserId}`,
        transferGroup: campaignId,
        metadata: {
          campaignId,
          creatorUserId,
          brandUserId: userId,
          type: 'creator_payout',
        },
      });

      return this.campaigns.upsertCreatorPayout({
        campaignId,
        brandUserId: userId,
        creatorUserId,
        amountCents,
        status: 'transferred',
        stripePaymentIntentId: paymentIntentId,
        stripeTransferId: transfer.transferId,
        stripeDestinationAccountId: readiness.accountId,
        idempotencyKey,
        failureReason: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Creator payout failed';
      await this.campaigns.upsertCreatorPayout({
        campaignId,
        brandUserId: userId,
        creatorUserId,
        amountCents,
        status: paymentIntentId ? 'charged' : 'failed',
        stripePaymentIntentId: paymentIntentId,
        stripeTransferId: null,
        stripeDestinationAccountId: readiness.accountId,
        idempotencyKey,
        failureReason: message,
      });
      throw new BadRequestException(message);
    }
  }

  async uploadFile(
    userId: string,
    campaignId: string,
    file: UploadableFile | undefined,
  ): Promise<CampaignFileMeta> {
    await this.requireBrand(userId);
    if (!file?.buffer?.length) {
      throw new BadRequestException('file is required');
    }
    if (file.size > MAX_FILE_BYTES) {
      throw new BadRequestException('File must be 25MB or smaller');
    }
    if (!isAllowedMime(file.mimetype)) {
      throw new BadRequestException(
        'Unsupported file type. Use images, PDF, ZIP, or common documents.',
      );
    }

    const campaign = await this.campaigns.getByIdForOwner(userId, campaignId);
    if (!campaign) {
      throw new NotFoundException('Campaign not found');
    }

    const safeName = sanitizeFileName(file.originalname);
    const key = `campaigns/${userId}/${campaignId}/${randomUUID()}-${safeName}`;
    const stored = await this.storage.upload(file, key);

    const row = await this.campaigns.createFile({
      campaignId,
      ownerUserId: userId,
      originalName: safeName,
      sizeBytes: file.size,
      contentType: file.mimetype || 'application/octet-stream',
      storageProvider: stored.provider,
      storageKey: stored.key,
    });

    await this.refreshFilesJson(campaignId);
    const updated = await this.campaigns.getByIdForOwner(userId, campaignId);
    if (updated) {
      await this.marketplaceSync?.syncFromCampaign(userId, updated);
    }
    return toFileMeta(row);
  }

  async downloadFile(
    userId: string,
    campaignId: string,
    fileId: string,
  ): Promise<{
    buffer: Buffer;
    contentType: string;
    fileName: string;
  }> {
    await this.requireBrand(userId);
    const row = await this.campaigns.getFileForOwner(
      userId,
      campaignId,
      fileId,
    );
    if (!row) {
      throw new NotFoundException('File not found');
    }
    const buffer = await this.storage.read({
      provider: row.storageProvider,
      key: row.storageKey,
    });
    return {
      buffer,
      contentType: row.contentType,
      fileName: row.originalName,
    };
  }

  async deleteFile(
    userId: string,
    campaignId: string,
    fileId: string,
  ): Promise<{ deleted: true }> {
    await this.requireBrand(userId);
    const row = await this.campaigns.deleteFile(userId, campaignId, fileId);
    if (!row) {
      throw new NotFoundException('File not found');
    }
    await this.storage.delete({
      provider: row.storageProvider,
      key: row.storageKey,
    });
    await this.refreshFilesJson(campaignId);
    const updated = await this.campaigns.getByIdForOwner(userId, campaignId);
    if (updated) {
      await this.marketplaceSync?.syncFromCampaign(userId, updated);
    }
    return { deleted: true };
  }

  private async refreshFilesJson(campaignId: string): Promise<void> {
    const rows = await this.campaigns.listFiles(campaignId);
    await this.campaigns.syncCampaignFilesJson(
      campaignId,
      rows.map(toFileMeta),
    );
  }

  private async requireBrand(userId: string): Promise<CampaignUser> {
    const user = await this.campaigns.getUser(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    if (user.role !== 'brand') {
      throw new ForbiddenException('Brand account required for campaigns');
    }
    return user;
  }

  private assertDateRange(dto: UpsertCampaignDto): void {
    if (dto.endDate < dto.startDate) {
      throw new BadRequestException('endDate must be on or after startDate');
    }
  }

  private assertPublishReady(
    dto: UpsertCampaignDto,
    existing?: CampaignRecord,
  ): void {
    if (dto.status !== 'active') {
      return;
    }

    const missing: string[] = [];
    if (!hasValue(dto.name, existing?.name)) missing.push('name');
    if (!hasValue(dto.campaignType, existing?.campaignType)) {
      missing.push('campaignType');
    }
    if (!hasValue(dto.contentTypes, existing?.contentTypes)) {
      missing.push('contentTypes');
    }
    if (!hasValue(dto.startDate, existing?.startDate)) {
      missing.push('startDate');
    }
    if (!hasValue(dto.endDate, existing?.endDate)) missing.push('endDate');
    if (!hasValue(dto.brief, existing?.brief)) missing.push('brief');
    if (!hasValue(dto.deliverables, existing?.deliverables)) {
      missing.push('deliverables');
    }
    if (!hasValue(dto.exampleVideoLinks, existing?.exampleVideoLinks)) {
      missing.push('exampleVideoLinks');
    }
    if (!hasValue(dto.requirements, existing?.requirements)) {
      missing.push('requirements');
    }
    if (!hasValue(dto.payment?.model, existing?.payment.model)) {
      missing.push('payment.model');
    }
    if (!hasValue(dto.postToMarketplace, existing?.postToMarketplace)) {
      missing.push('postToMarketplace');
    }

    if (missing.length > 0) {
      throw new BadRequestException(
        `Active campaigns require: ${missing.join(', ')}`,
      );
    }
  }

  private normalizeCampaignInput(
    dto: UpsertCampaignDto,
    existing?: CampaignRecord,
  ): UpsertCampaignDto {
    const now = new Date();
    const defaultStartDate = existing?.startDate ?? formatDateOnly(now);
    const defaultEndDate =
      existing?.endDate ?? formatDateOnly(addMonths(now, 1));
    const requirements = dto.requirements ?? existing?.requirements;
    const payment = dto.payment ?? existing?.payment;
    const benefits = dto.creatorBenefits ?? existing?.creatorBenefits;
    const contentRights = dto.contentRights ?? existing?.contentRights;

    return {
      name: normalizeString(dto.name, existing?.name, 'Untitled campaign'),
      campaignType: dto.campaignType ?? existing?.campaignType ?? 'experience',
      contentTypes: dto.contentTypes ?? existing?.contentTypes ?? ['tiktok'],
      status: dto.status,
      startDate: dto.startDate ?? defaultStartDate,
      endDate: dto.endDate ?? defaultEndDate,
      brief: dto.brief ?? existing?.brief ?? '',
      deliverables: dto.deliverables ?? existing?.deliverables ?? '',
      exampleVideoLinks:
        dto.exampleVideoLinks ?? existing?.exampleVideoLinks ?? [],
      requirements: {
        niches: requirements?.niches ?? [],
        minFollowersRange: requirements?.minFollowersRange ?? '',
        location: requirements?.location ?? '',
        platforms: requirements?.platforms ?? [],
      },
      files: dto.files ?? existing?.files ?? [],
      payment: {
        model: payment?.model ?? 'flat_rate',
        ...(payment?.flatRateCents !== undefined
          ? { flatRateCents: payment.flatRateCents }
          : {}),
        ...(payment?.milestoneStructure !== undefined
          ? { milestoneStructure: payment.milestoneStructure }
          : {}),
        ...(payment?.milestones !== undefined
          ? { milestones: payment.milestones }
          : {}),
        ...(payment?.royaltyPercent !== undefined
          ? { royaltyPercent: payment.royaltyPercent }
          : {}),
        ...(payment?.notes !== undefined ? { notes: payment.notes } : {}),
      },
      requiredTasks: dto.requiredTasks ?? existing?.requiredTasks ?? [],
      creatorBenefits: {
        ...(benefits?.guaranteedPaymentCents !== undefined
          ? { guaranteedPaymentCents: benefits.guaranteedPaymentCents }
          : {}),
        productsKept: benefits?.productsKept ?? false,
        bonusEligibility: benefits?.bonusEligibility ?? false,
        creatorPoolEligibility: benefits?.creatorPoolEligibility ?? false,
        foundingCreatorRecognition:
          benefits?.foundingCreatorRecognition ?? false,
        portfolioUse: benefits?.portfolioUse ?? false,
        priorityFutureCampaigns:
          benefits?.priorityFutureCampaigns ?? false,
        brandOpportunityAccess: benefits?.brandOpportunityAccess ?? false,
        customBenefits: benefits?.customBenefits ?? [],
      },
      contentRights: {
        organicUsage: contentRights?.organicUsage ?? true,
        websiteAppUsage: contentRights?.websiteAppUsage ?? false,
        paidAdsUsage: contentRights?.paidAdsUsage ?? false,
        duration: contentRights?.duration ?? '',
        rawContentAccess: contentRights?.rawContentAccess ?? false,
      },
      productsProvided:
        dto.productsProvided ?? existing?.productsProvided ?? [],
      ...(dto.creatorCapacity ?? existing?.creatorCapacity
        ? { creatorCapacity: dto.creatorCapacity ?? existing?.creatorCapacity }
        : {}),
      postToMarketplace:
        dto.postToMarketplace ?? existing?.postToMarketplace ?? false,
    };
  }

  private requiresPlatformFee(dto: UpsertCampaignDto): boolean {
    // Temporarily disabled — payment UX removed from create/publish for now.
    // Re-enable: return dto.status === 'active';
    void dto;
    return false;
  }

  private async collectPlatformFee(
    userId: string,
    campaign: Pick<CampaignRecord, 'id' | 'name' | 'payment'>,
  ): Promise<CampaignPlatformFeeRecord> {
    const existing = await this.campaigns.getPlatformFee(campaign.id);
    if (existing?.status === 'paid' || existing?.status === 'waived') {
      return existing;
    }

    const preview = previewPlatformFee(
      campaign.payment as CampaignPaymentForFee,
    );
    const idempotencyKey = `campaign-fee:${campaign.id}`;

    if (preview.feeCents === 0) {
      return this.campaigns.upsertPlatformFee({
        campaignId: campaign.id,
        brandUserId: userId,
        payoutCents: preview.payoutCents,
        feeCents: 0,
        status: 'waived',
        stripePaymentIntentId: null,
        idempotencyKey,
      });
    }

    const chargeContext = await this.billing.resolveChargeContext(userId);
    if (!chargeContext) {
      throw new BadRequestException(
        'Add a default payment method in Settings → Payment methods before activating a campaign.',
      );
    }

    try {
      const charge = await this.stripe.chargeOffSession({
        customerId: chargeContext.customerId,
        paymentMethodId: chargeContext.paymentMethodId,
        amountCents: preview.feeCents,
        description: `Thesi campaign platform fee — ${campaign.name}`,
        idempotencyKey,
        metadata: {
          campaignId: campaign.id,
          brandUserId: userId,
          type: 'campaign_platform_fee',
        },
      });

      const fee = await this.campaigns.upsertPlatformFee({
        campaignId: campaign.id,
        brandUserId: userId,
        payoutCents: preview.payoutCents,
        feeCents: preview.feeCents,
        status: 'paid',
        stripePaymentIntentId: charge.paymentIntentId,
        idempotencyKey,
      });

      await this.billing.recordPlatformFeeInvoice({
        brandUserId: userId,
        campaignName: campaign.name,
        feeCents: preview.feeCents,
        stripePaymentIntentId: charge.paymentIntentId,
      });

      return fee;
    } catch (error) {
      await this.campaigns.upsertPlatformFee({
        campaignId: campaign.id,
        brandUserId: userId,
        payoutCents: preview.payoutCents,
        feeCents: preview.feeCents,
        status: 'failed',
        stripePaymentIntentId: null,
        idempotencyKey,
      });
      const message =
        error instanceof Error ? error.message : 'Platform fee charge failed';
      throw new BadRequestException(message);
    }
  }
}

function isAllowedMime(mime: string): boolean {
  if (!mime) return false;
  return ALLOWED_MIME_PREFIXES.some(
    (prefix) => mime === prefix || mime.startsWith(prefix),
  );
}

function addMonths(date: Date, months: number): Date {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeString(
  value: string | undefined,
  fallback: string | undefined,
  defaultValue: string,
): string {
  return value?.trim() || fallback?.trim() || defaultValue;
}

function hasValue<T>(value: T | undefined, fallback: T | undefined): boolean {
  return value !== undefined || fallback !== undefined;
}
