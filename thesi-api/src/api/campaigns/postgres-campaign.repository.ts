import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import { toFileMeta } from './campaign-file.mapper';
import type { UpsertCampaignDto } from './dto/campaign.dto';
import type {
  CampaignFileMeta,
  CampaignFileRow,
  CampaignPlatformFeeRecord,
  CampaignRecord,
  CampaignRepository,
  CampaignUser,
  CreateCampaignFileInput,
  CreatorPayoutRecord,
} from './campaign.repository';

@Injectable()
export class PostgresCampaignRepository implements CampaignRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string): Promise<CampaignUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return user ?? null;
  }

  async listByOwner(ownerUserId: string): Promise<CampaignRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.campaign)
      .where(eq(schema.campaign.ownerUserId, ownerUserId))
      .orderBy(desc(schema.campaign.updatedAt));
    return Promise.all(rows.map((row) => this.mapCampaignWithFiles(row)));
  }

  async getByIdForOwner(
    ownerUserId: string,
    campaignId: string,
  ): Promise<CampaignRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.campaign)
      .where(
        and(
          eq(schema.campaign.id, campaignId),
          eq(schema.campaign.ownerUserId, ownerUserId),
        ),
      )
      .limit(1);
    return row ? this.mapCampaignWithFiles(row) : null;
  }

  async create(
    ownerUserId: string,
    input: UpsertCampaignDto,
  ): Promise<CampaignRecord> {
    const [row] = await this.db
      .insert(schema.campaign)
      .values({
        ownerUserId,
        name: input.name,
        campaignType: input.campaignType,
        type: input.type,
        status: input.status,
        startDate: input.startDate,
        endDate: input.endDate,
        brief: input.brief,
        deliverables: input.deliverables,
        exampleVideoLinks: normalizeExampleVideoLinks(input.exampleVideoLinks),
        requirements: input.requirements,
        files: [],
        payment: input.payment,
        postToMarketplace: input.postToMarketplace,
      })
      .returning();
    return this.mapCampaignWithFiles(row);
  }

  async update(
    ownerUserId: string,
    campaignId: string,
    input: UpsertCampaignDto,
  ): Promise<CampaignRecord | null> {
    const [row] = await this.db
      .update(schema.campaign)
      .set({
        name: input.name,
        campaignType: input.campaignType,
        type: input.type,
        status: input.status,
        startDate: input.startDate,
        endDate: input.endDate,
        brief: input.brief,
        deliverables: input.deliverables,
        exampleVideoLinks: normalizeExampleVideoLinks(input.exampleVideoLinks),
        requirements: input.requirements,
        // files are managed via /campaigns/:id/files — do not clobber
        payment: input.payment,
        postToMarketplace: input.postToMarketplace,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.campaign.id, campaignId),
          eq(schema.campaign.ownerUserId, ownerUserId),
        ),
      )
      .returning();
    return row ? this.mapCampaignWithFiles(row) : null;
  }

  async createFile(input: CreateCampaignFileInput): Promise<CampaignFileRow> {
    const [row] = await this.db
      .insert(schema.campaignFile)
      .values({
        campaignId: input.campaignId,
        ownerUserId: input.ownerUserId,
        originalName: input.originalName,
        sizeBytes: input.sizeBytes,
        contentType: input.contentType,
        storageProvider: input.storageProvider,
        storageKey: input.storageKey,
      })
      .returning();
    return mapFileRow(row);
  }

  async listFiles(campaignId: string): Promise<CampaignFileRow[]> {
    const rows = await this.db
      .select()
      .from(schema.campaignFile)
      .where(eq(schema.campaignFile.campaignId, campaignId))
      .orderBy(desc(schema.campaignFile.createdAt));
    return rows.map(mapFileRow);
  }

  async getFileForOwner(
    ownerUserId: string,
    campaignId: string,
    fileId: string,
  ): Promise<CampaignFileRow | null> {
    const [row] = await this.db
      .select()
      .from(schema.campaignFile)
      .where(
        and(
          eq(schema.campaignFile.id, fileId),
          eq(schema.campaignFile.campaignId, campaignId),
          eq(schema.campaignFile.ownerUserId, ownerUserId),
        ),
      )
      .limit(1);
    return row ? mapFileRow(row) : null;
  }

  async deleteFile(
    ownerUserId: string,
    campaignId: string,
    fileId: string,
  ): Promise<CampaignFileRow | null> {
    const [row] = await this.db
      .delete(schema.campaignFile)
      .where(
        and(
          eq(schema.campaignFile.id, fileId),
          eq(schema.campaignFile.campaignId, campaignId),
          eq(schema.campaignFile.ownerUserId, ownerUserId),
        ),
      )
      .returning();
    return row ? mapFileRow(row) : null;
  }

  async syncCampaignFilesJson(
    campaignId: string,
    files: CampaignFileMeta[],
  ): Promise<void> {
    await this.db
      .update(schema.campaign)
      .set({ files, updatedAt: new Date() })
      .where(eq(schema.campaign.id, campaignId));
  }

  async getPlatformFee(
    campaignId: string,
  ): Promise<CampaignPlatformFeeRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.campaignPlatformFee)
      .where(eq(schema.campaignPlatformFee.campaignId, campaignId))
      .limit(1);
    return row ? this.toPlatformFee(row) : null;
  }

  async upsertPlatformFee(input: {
    campaignId: string;
    brandUserId: string;
    payoutCents: number;
    feeCents: number;
    currency?: string;
    status: CampaignPlatformFeeRecord['status'];
    stripePaymentIntentId?: string | null;
    idempotencyKey: string;
  }): Promise<CampaignPlatformFeeRecord> {
    const [row] = await this.db
      .insert(schema.campaignPlatformFee)
      .values({
        campaignId: input.campaignId,
        brandUserId: input.brandUserId,
        payoutCents: input.payoutCents,
        feeCents: input.feeCents,
        currency: input.currency ?? 'usd',
        status: input.status,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        idempotencyKey: input.idempotencyKey,
      })
      .onConflictDoUpdate({
        target: schema.campaignPlatformFee.campaignId,
        set: {
          payoutCents: input.payoutCents,
          feeCents: input.feeCents,
          currency: input.currency ?? 'usd',
          status: input.status,
          stripePaymentIntentId: input.stripePaymentIntentId ?? null,
          idempotencyKey: input.idempotencyKey,
          updatedAt: new Date(),
        },
      })
      .returning();
    return this.toPlatformFee(row);
  }

  private toPlatformFee(
    row: typeof schema.campaignPlatformFee.$inferSelect,
  ): CampaignPlatformFeeRecord {
    return {
      id: row.id,
      campaignId: row.campaignId,
      brandUserId: row.brandUserId,
      payoutCents: row.payoutCents,
      feeCents: row.feeCents,
      currency: row.currency,
      status: row.status as CampaignPlatformFeeRecord['status'],
      ...(row.stripePaymentIntentId
        ? { stripePaymentIntentId: row.stripePaymentIntentId }
        : {}),
      idempotencyKey: row.idempotencyKey,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  async getCreatorPayout(campaignId: string, creatorUserId: string) {
    const [row] = await this.db
      .select()
      .from(schema.creatorPayout)
      .where(
        and(
          eq(schema.creatorPayout.campaignId, campaignId),
          eq(schema.creatorPayout.creatorUserId, creatorUserId),
        ),
      )
      .limit(1);
    return row ? this.toCreatorPayout(row) : null;
  }

  async listCreatorPayoutsForCampaign(campaignId: string) {
    const rows = await this.db
      .select()
      .from(schema.creatorPayout)
      .where(eq(schema.creatorPayout.campaignId, campaignId))
      .orderBy(desc(schema.creatorPayout.createdAt));
    return rows.map((row) => this.toCreatorPayout(row));
  }

  async listCreatorPayoutsForCreator(creatorUserId: string) {
    const rows = await this.db
      .select()
      .from(schema.creatorPayout)
      .where(eq(schema.creatorPayout.creatorUserId, creatorUserId))
      .orderBy(desc(schema.creatorPayout.createdAt));
    return rows.map((row) => this.toCreatorPayout(row));
  }

  async upsertCreatorPayout(input: {
    campaignId: string;
    brandUserId: string;
    creatorUserId: string;
    amountCents: number;
    currency?: string;
    status: CreatorPayoutRecord['status'];
    stripePaymentIntentId?: string | null;
    stripeTransferId?: string | null;
    stripeDestinationAccountId: string;
    idempotencyKey: string;
    failureReason?: string | null;
  }) {
    const [row] = await this.db
      .insert(schema.creatorPayout)
      .values({
        campaignId: input.campaignId,
        brandUserId: input.brandUserId,
        creatorUserId: input.creatorUserId,
        amountCents: input.amountCents,
        currency: input.currency ?? 'usd',
        status: input.status,
        stripePaymentIntentId: input.stripePaymentIntentId ?? null,
        stripeTransferId: input.stripeTransferId ?? null,
        stripeDestinationAccountId: input.stripeDestinationAccountId,
        idempotencyKey: input.idempotencyKey,
        failureReason: input.failureReason ?? null,
      })
      .onConflictDoUpdate({
        target: [
          schema.creatorPayout.campaignId,
          schema.creatorPayout.creatorUserId,
        ],
        set: {
          amountCents: input.amountCents,
          currency: input.currency ?? 'usd',
          status: input.status,
          stripePaymentIntentId: input.stripePaymentIntentId ?? null,
          stripeTransferId: input.stripeTransferId ?? null,
          stripeDestinationAccountId: input.stripeDestinationAccountId,
          idempotencyKey: input.idempotencyKey,
          failureReason: input.failureReason ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return this.toCreatorPayout(row);
  }

  private toCreatorPayout(
    row: typeof schema.creatorPayout.$inferSelect,
  ): CreatorPayoutRecord {
    return {
      id: row.id,
      campaignId: row.campaignId,
      brandUserId: row.brandUserId,
      creatorUserId: row.creatorUserId,
      amountCents: row.amountCents,
      currency: row.currency,
      status: row.status as CreatorPayoutRecord['status'],
      ...(row.stripePaymentIntentId
        ? { stripePaymentIntentId: row.stripePaymentIntentId }
        : {}),
      ...(row.stripeTransferId
        ? { stripeTransferId: row.stripeTransferId }
        : {}),
      stripeDestinationAccountId: row.stripeDestinationAccountId,
      idempotencyKey: row.idempotencyKey,
      ...(row.failureReason ? { failureReason: row.failureReason } : {}),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async mapCampaignWithFiles(
    row: typeof schema.campaign.$inferSelect,
  ): Promise<CampaignRecord> {
    const fileRows = await this.listFiles(row.id);
    return {
      id: row.id,
      name: row.name,
      campaignType: row.campaignType as CampaignRecord['campaignType'],
      type: row.type as CampaignRecord['type'],
      status: row.status as CampaignRecord['status'],
      startDate: row.startDate,
      endDate: row.endDate,
      brief: row.brief,
      deliverables: row.deliverables,
      exampleVideoLinks: normalizeExampleVideoLinks(row.exampleVideoLinks),
      requirements: normalizeRequirements(row.requirements),
      files: fileRows.map(toFileMeta),
      payment: normalizePayment(row.payment),
      postToMarketplace: row.postToMarketplace,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}

function mapFileRow(
  row: typeof schema.campaignFile.$inferSelect,
): CampaignFileRow {
  return {
    id: row.id,
    campaignId: row.campaignId,
    ownerUserId: row.ownerUserId,
    originalName: row.originalName,
    sizeBytes: Number(row.sizeBytes),
    contentType: row.contentType,
    storageProvider: row.storageProvider as CampaignFileRow['storageProvider'],
    storageKey: row.storageKey,
    createdAt: row.createdAt.toISOString(),
  };
}

function normalizeRequirements(
  value: typeof schema.campaign.$inferSelect['requirements'],
): CampaignRecord['requirements'] {
  return {
    niches: Array.isArray(value?.niches) ? value.niches : [],
    minFollowersRange: value?.minFollowersRange ?? '',
    location: value?.location ?? '',
    platforms: Array.isArray(value?.platforms) ? value.platforms : [],
  };
}

function normalizePayment(
  value: typeof schema.campaign.$inferSelect['payment'],
): CampaignRecord['payment'] {
  return {
    model: value?.model ?? 'flat_rate',
    ...(value?.flatRateCents !== undefined
      ? { flatRateCents: value.flatRateCents }
      : {}),
    ...(value?.milestones ? { milestones: value.milestones } : {}),
    ...(value?.royaltyPercent !== undefined
      ? { royaltyPercent: value.royaltyPercent }
      : {}),
    ...(value?.notes ? { notes: value.notes } : {}),
  };
}

function normalizeExampleVideoLinks(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}
