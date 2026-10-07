import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { workspaceContext } from '../brand-workspaces/workspace-context';
import { CampaignsService } from '../campaigns/campaigns.service';
import type { CampaignRecord } from '../campaigns/campaign.repository';
import type { UpsertCampaignDto } from '../campaigns/dto/campaign.dto';
import { promotedProducts } from '../campaigns/promoted-products';

const CONTENT_TYPES = ['tiktok', 'instagram_reels', 'youtube_shorts', 'ugc_photos', 'mixed_bundle', 'long_form'] as const;

export type ProductCampaignInput = {
  vendorId: string;
  brandId: string;
  productId: string;
  campaignId?: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  brief: string;
  deliverables: string;
  contentTypes: string[];
  commissionType: 'percentage_of_sale' | 'fixed_amount_per_sale';
  commissionPercent?: number;
  fixedAmountCents?: number;
  notes: string;
  attributionWindowDays: number;
  creatorSlots: number;
  reviewDays: number;
  payoutFrequency: 'on_approval' | 'weekly' | 'monthly';
  minimumPayoutCents: number;
};

type LinkRow = { id: string; workspace_id: string; linked_by_user_id: string };

export type ProductCampaignView = {
  id: string;
  status: string;
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  brief: string;
  deliverables: string;
  contentTypes: string[];
  commissionType: 'percentage_of_sale' | 'fixed_amount_per_sale';
  amount: string;
  notes: string;
  attributionWindowDays: number;
  creatorSlots: number;
  reviewDays: number;
  payoutFrequency: 'on_approval' | 'weekly' | 'monthly';
  minimumPayout: string;
  replaced: boolean;
};

@Injectable()
export class ProductCampaignService {
  constructor(
    @Inject(DrizzleAsyncProvider) private readonly db: NodePgDatabase<typeof schema>,
    private readonly config: ConfigService,
    private readonly campaigns: CampaignsService,
  ) {}

  async read(vendorId: string, brandId: string, campaignId: string): Promise<ProductCampaignView> {
    const link = await this.link(vendorId, brandId);
    const campaign = await this.run(link, () => this.campaigns.get(link.linked_by_user_id, campaignId));
    return this.view(campaign, false);
  }

  async current(vendorId: string, brandId: string, productId: string): Promise<ProductCampaignView | null> {
    const link = await this.link(vendorId, brandId);
    const campaign = await this.findCurrent(link, productId);
    return campaign ? this.view(campaign, false) : null;
  }

  async upsert(input: ProductCampaignInput): Promise<ProductCampaignView> {
    this.assertInput(input);
    const link = await this.link(input.vendorId, input.brandId);
    const existing = await this.findCurrent(link, input.productId);
    if (existing && existing.status !== 'draft' && !this.materialChange(existing, input)) {
      const campaign = await this.run(link, () => this.campaigns.update(
        link.linked_by_user_id,
        existing.id,
        this.dtoFromRecord(existing, {
          name: input.name,
          description: input.description,
          brief: input.brief,
          deliverables: input.deliverables,
          contentTypes: input.contentTypes as UpsertCampaignDto['contentTypes'],
          creatorCapacity: input.creatorSlots,
          status: 'active',
          postToMarketplace: true,
        }),
      ));
      return this.view(campaign, false);
    }
    if (existing && existing.status === 'active') {
      await this.run(link, () => this.campaigns.update(
        link.linked_by_user_id,
        existing.id,
        this.dtoFromRecord(existing, { status: 'paused', postToMarketplace: false }),
      ));
    }
    const create = () => this.campaigns.create(link.linked_by_user_id, this.dto(input, existing?.status === 'draft' ? undefined : 'active'));
    try {
      const campaign = existing?.status === 'draft'
        ? await this.run(link, () => this.campaigns.update(link.linked_by_user_id, existing.id, this.dto(input, 'active')))
        : await this.run(link, create);
      return this.view(campaign, Boolean(existing && existing.status === 'active'));
    } catch (error) {
      if (existing?.status === 'active') {
        await this.run(link, () => this.campaigns.update(
          link.linked_by_user_id,
          existing.id,
          this.dtoFromRecord(existing, { status: 'active', postToMarketplace: true }),
        )).catch(() => undefined);
      }
      throw error;
    }
  }

  private assertInput(input: ProductCampaignInput) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(input.endDate) || input.endDate < input.startDate) {
      throw new BadRequestException('Choose a start date and an end date on or after it.');
    }
    if (!input.brief.trim() || !input.deliverables.trim() || !input.notes.trim()) {
      throw new BadRequestException('Add a brief, deliverables, and notes before posting.');
    }
    if (!input.contentTypes.length || input.contentTypes.some((type) => !CONTENT_TYPES.includes(type as typeof CONTENT_TYPES[number]))) {
      throw new BadRequestException('Choose at least one content type.');
    }
    if (!Number.isInteger(input.attributionWindowDays) || input.attributionWindowDays < 1 || input.attributionWindowDays > 365) {
      throw new BadRequestException('Attribution window must be between 1 and 365 days.');
    }
    if (!Number.isInteger(input.creatorSlots) || input.creatorSlots < 1) {
      throw new BadRequestException('Creator slots must be at least 1.');
    }
    if (!Number.isInteger(input.reviewDays) || input.reviewDays < 0 || input.reviewDays > 365) {
      throw new BadRequestException('Sale review must be between 0 and 365 days.');
    }
    if (!['on_approval', 'weekly', 'monthly'].includes(input.payoutFrequency)) {
      throw new BadRequestException('Choose a payout schedule.');
    }
    if (!Number.isInteger(input.minimumPayoutCents) || input.minimumPayoutCents < 0) {
      throw new BadRequestException('Minimum payout must be zero or more.');
    }
  }

  private materialChange(campaign: CampaignRecord, input: ProductCampaignInput) {
    const affiliate = campaign.payment.hybrid?.affiliate;
    const rules = affiliate?.rules;
    return campaign.startDate !== input.startDate
      || campaign.endDate !== input.endDate
      || affiliate?.commissionType !== input.commissionType
      || affiliate?.attributionWindowDays !== input.attributionWindowDays
      || (affiliate?.terms ?? '') !== input.notes.trim()
      || (input.commissionType === 'percentage_of_sale'
        ? affiliate?.commissionPercent !== input.commissionPercent
        : affiliate?.fixedAmountCents !== input.fixedAmountCents)
      || (rules
        ? rules.reviewDays !== input.reviewDays
          || rules.payoutFrequency !== input.payoutFrequency
          || rules.minimumPayoutCents !== input.minimumPayoutCents
        : false);
  }

  private dto(input: ProductCampaignInput, status: 'active' | undefined): UpsertCampaignDto {
    const rulesEnabled = this.config.get('COMMISSION_RULES_ENABLED') === true;
    const multi = this.config.get('CAMPAIGN_MULTI_PRODUCTS_ENABLED') === true;
    const affiliate = {
      enabled: true,
      commissionType: input.commissionType,
      currency: 'USD' as const,
      attributionWindowDays: input.attributionWindowDays,
      terms: input.notes.trim(),
      fundingFlowVersion: 1 as const,
      payoutHandler: 'clothme' as const,
      fundingSource: 'brand' as const,
      fundingTerms: 'Commission is funded by qualifying sales.',
      ...(input.commissionType === 'percentage_of_sale'
        ? { commissionPercent: input.commissionPercent }
        : { fixedAmountCents: input.fixedAmountCents }),
      ...(rulesEnabled ? {
        rules: {
          version: 1 as const,
          reviewDays: input.reviewDays,
          payoutFrequency: input.payoutFrequency,
          minimumPayoutCents: input.minimumPayoutCents,
          creatorFeeCents: 0 as const,
          creditPolicy: 'hold_until_verified' as const,
          selfReferralPolicy: 'hold_until_reviewed' as const,
        },
      } : {}),
    };
    return {
      ...(multi ? { merchantProducts: [{ productId: input.productId }] } : { merchantProductId: input.productId }),
      name: input.name.slice(0, 160),
      description: input.description.slice(0, 1000),
      campaignType: 'product',
      contentTypes: input.contentTypes as UpsertCampaignDto['contentTypes'],
      status: status ?? 'active',
      startDate: input.startDate,
      endDate: input.endDate,
      brief: input.brief.trim(),
      deliverables: input.deliverables.trim(),
      exampleVideoLinks: [],
      requirements: { niches: [], minFollowersRange: '', location: '', platforms: [] },
      files: [],
      payment: { model: 'commission', hybrid: { affiliate } },
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
      creatorCapacity: input.creatorSlots,
      creatorDisclosureEnabled: false,
      postToMarketplace: true,
    };
  }

  private dtoFromRecord(campaign: CampaignRecord, patch: Partial<UpsertCampaignDto>): UpsertCampaignDto {
    return {
      name: campaign.name,
      description: campaign.description,
      campaignType: campaign.campaignType,
      contentTypes: campaign.contentTypes,
      status: campaign.status,
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      brief: campaign.brief,
      deliverables: campaign.deliverables,
      exampleVideoLinks: campaign.exampleVideoLinks,
      requirements: campaign.requirements,
      files: campaign.files,
      payment: campaign.payment,
      requiredTasks: campaign.requiredTasks,
      creatorBenefits: campaign.creatorBenefits,
      contentRights: campaign.contentRights,
      productsProvided: campaign.productsProvided,
      creatorCapacity: campaign.creatorCapacity,
      creatorDisclosureEnabled: campaign.creatorDisclosureEnabled,
      postToMarketplace: campaign.postToMarketplace,
      ...patch,
    };
  }

  private view(campaign: CampaignRecord, replaced: boolean): ProductCampaignView {
    const affiliate = campaign.payment.hybrid?.affiliate;
    const fixed = affiliate?.commissionType === 'fixed_amount_per_sale';
    const rules = affiliate?.rules;
    return {
      id: campaign.id,
      status: campaign.status,
      name: campaign.name,
      description: campaign.description ?? '',
      startDate: campaign.startDate,
      endDate: campaign.endDate,
      brief: campaign.brief,
      deliverables: campaign.deliverables,
      contentTypes: campaign.contentTypes,
      commissionType: fixed ? 'fixed_amount_per_sale' : 'percentage_of_sale',
      amount: fixed
        ? ((affiliate?.fixedAmountCents ?? 0) / 100).toFixed(2)
        : String(affiliate?.commissionPercent ?? ''),
      notes: affiliate?.terms ?? '',
      attributionWindowDays: affiliate?.attributionWindowDays ?? 30,
      creatorSlots: campaign.creatorCapacity ?? 5,
      reviewDays: rules?.reviewDays ?? 30,
      payoutFrequency: rules?.payoutFrequency ?? 'on_approval',
      minimumPayout: ((rules?.minimumPayoutCents ?? 0) / 100).toFixed(2),
      replaced,
    };
  }

  private async findCurrent(link: LinkRow, productId: string): Promise<CampaignRecord | null> {
    const listed = await this.run(link, () => this.campaigns.list(link.linked_by_user_id));
    const matches = listed.campaigns.filter((campaign) =>
      promotedProducts(campaign.payment).some((product) => product.productId === productId),
    );
    const newest = (status: CampaignRecord['status']) =>
      matches
        .filter((campaign) => campaign.status === status)
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] ?? null;
    return newest('active') ?? newest('draft');
  }

  private async link(vendorId: string, brandId: string): Promise<LinkRow> {
    if (this.config.get('MERCHANT_LINKING_ENABLED') !== true) throw new NotFoundException('Merchant linking is unavailable');
    const result = await this.db.execute(sql`SELECT l.id, l.workspace_id, l.linked_by_user_id
      FROM thesi.merchant_brand_link l
      JOIN thesi.brand_workspace w ON w.id = l.workspace_id
      WHERE l.vendor_id = ${vendorId}::uuid AND l.merchant_brand_id = ${brandId}::uuid
        AND l.revoked_at IS NULL AND w.status = 'active'`);
    const link = result.rows[0] as LinkRow | undefined;
    if (!link) throw new NotFoundException('Connect this brand to Thesi before posting a campaign.');
    return link;
  }

  private run<T>(link: LinkRow, work: () => Promise<T>): Promise<T> {
    return workspaceContext.run({
      workspaceId: link.workspace_id,
      actorUserId: link.linked_by_user_id,
      ownerUserId: link.linked_by_user_id,
      role: 'owner',
    }, work);
  }
}
