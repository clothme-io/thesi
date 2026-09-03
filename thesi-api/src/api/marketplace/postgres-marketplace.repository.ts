import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type {
  MarketplaceApplicationRecord,
  MarketplaceBrandApplicationRecord,
  MarketplaceFileRow,
  MarketplaceListingRecord,
  MarketplaceRepository,
  MarketplaceUser,
  UpsertListingFromCampaignInput,
} from './marketplace.repository';
import { buildListingPayload } from './marketplace-listing.mapper';

@Injectable()
export class PostgresMarketplaceRepository implements MarketplaceRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string): Promise<MarketplaceUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
        email: schema.thesiUser.email,
        fullName: schema.thesiUser.fullName,
        companyName: schema.thesiUser.companyName,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return user ?? null;
  }

  async getBrandDisplayName(userId: string): Promise<string | null> {
    const [profile] = await this.db
      .select({ companyName: schema.brandProfile.companyName })
      .from(schema.brandProfile)
      .where(eq(schema.brandProfile.userId, userId))
      .limit(1);
    if (profile?.companyName) return profile.companyName;
    const user = await this.getUser(userId);
    return user?.companyName || user?.fullName || null;
  }

  async upsertListingFromCampaign(
    input: UpsertListingFromCampaignInput,
  ): Promise<MarketplaceListingRecord> {
    const payload = buildListingPayload(input.campaign, input.brandName);
    const [row] = await this.db
      .insert(schema.marketplaceListing)
      .values({
        campaignId: input.campaign.id,
        ownerUserId: input.ownerUserId,
        ...payload,
      })
      .onConflictDoUpdate({
        target: schema.marketplaceListing.campaignId,
        set: {
          ownerUserId: input.ownerUserId,
          ...payload,
          updatedAt: new Date(),
        },
      })
      .returning();
    return this.mapListing(row, await this.countApplicants(row.id));
  }

  async deleteListingByCampaignId(campaignId: string): Promise<void> {
    await this.db
      .delete(schema.marketplaceListing)
      .where(eq(schema.marketplaceListing.campaignId, campaignId));
  }

  async listAll(): Promise<MarketplaceListingRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.marketplaceListing)
      .orderBy(desc(schema.marketplaceListing.postedAt));
    return Promise.all(
      rows.map(async (row) =>
        this.mapListing(row, await this.countApplicants(row.id)),
      ),
    );
  }

  async listByOwner(ownerUserId: string): Promise<MarketplaceListingRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.marketplaceListing)
      .where(eq(schema.marketplaceListing.ownerUserId, ownerUserId))
      .orderBy(desc(schema.marketplaceListing.postedAt));
    return Promise.all(
      rows.map(async (row) =>
        this.mapListing(row, await this.countApplicants(row.id)),
      ),
    );
  }

  async getById(listingId: string): Promise<MarketplaceListingRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.marketplaceListing)
      .where(eq(schema.marketplaceListing.id, listingId))
      .limit(1);
    return row
      ? this.mapListing(row, await this.countApplicants(row.id))
      : null;
  }

  async getListingFile(
    listingId: string,
    fileId: string,
  ): Promise<MarketplaceFileRow | null> {
    const [row] = await this.db
      .select({
        id: schema.campaignFile.id,
        campaignId: schema.campaignFile.campaignId,
        ownerUserId: schema.campaignFile.ownerUserId,
        originalName: schema.campaignFile.originalName,
        sizeBytes: schema.campaignFile.sizeBytes,
        contentType: schema.campaignFile.contentType,
        storageProvider: schema.campaignFile.storageProvider,
        storageKey: schema.campaignFile.storageKey,
        createdAt: schema.campaignFile.createdAt,
      })
      .from(schema.marketplaceListing)
      .innerJoin(
        schema.campaignFile,
        and(
          eq(
            schema.campaignFile.campaignId,
            schema.marketplaceListing.campaignId,
          ),
          eq(schema.campaignFile.id, fileId),
        ),
      )
      .where(eq(schema.marketplaceListing.id, listingId))
      .limit(1);

    return row
      ? {
          ...row,
          sizeBytes: Number(row.sizeBytes),
          storageProvider:
            row.storageProvider as MarketplaceFileRow['storageProvider'],
          createdAt: row.createdAt.toISOString(),
        }
      : null;
  }

  async listApplicationsForCreator(
    creatorUserId: string,
  ): Promise<MarketplaceApplicationRecord[]> {
    const rows = await this.db
      .select()
      .from(schema.marketplaceApplication)
      .where(eq(schema.marketplaceApplication.creatorUserId, creatorUserId))
      .orderBy(desc(schema.marketplaceApplication.appliedAt));
    return rows.map((row) => ({
      id: row.id,
      listingId: row.listingId,
      pitch: row.pitch,
      appliedAt: row.appliedAt.toISOString(),
      addedToCrm: row.addedToCrm,
      status: row.status as MarketplaceApplicationRecord['status'],
    }));
  }

  async listApplicationsForListing(
    listingId: string,
  ): Promise<MarketplaceBrandApplicationRecord[]> {
    const rows = await this.db
      .select({
        id: schema.marketplaceApplication.id,
        listingId: schema.marketplaceApplication.listingId,
        pitch: schema.marketplaceApplication.pitch,
        appliedAt: schema.marketplaceApplication.appliedAt,
        addedToCrm: schema.marketplaceApplication.addedToCrm,
        status: schema.marketplaceApplication.status,
        creatorUserId: schema.marketplaceApplication.creatorUserId,
        creatorName: schema.thesiUser.fullName,
        creatorEmail: schema.thesiUser.email,
        displayName: schema.creatorProfile.displayName,
      })
      .from(schema.marketplaceApplication)
      .innerJoin(
        schema.thesiUser,
        eq(schema.thesiUser.id, schema.marketplaceApplication.creatorUserId),
      )
      .leftJoin(
        schema.creatorProfile,
        eq(
          schema.creatorProfile.userId,
          schema.marketplaceApplication.creatorUserId,
        ),
      )
      .where(eq(schema.marketplaceApplication.listingId, listingId))
      .orderBy(desc(schema.marketplaceApplication.appliedAt));

    return rows.map((row) => ({
      id: row.id,
      listingId: row.listingId,
      pitch: row.pitch,
      appliedAt: row.appliedAt.toISOString(),
      addedToCrm: row.addedToCrm,
      status: row.status as MarketplaceApplicationRecord['status'],
      creatorUserId: row.creatorUserId,
      creatorName: row.displayName?.trim() || row.creatorName,
      creatorEmail: row.creatorEmail,
    }));
  }

  async listCrmLinkedListingIds(creatorUserId: string): Promise<string[]> {
    const rows = await this.db
      .select({ listingId: schema.marketplaceCrmLink.listingId })
      .from(schema.marketplaceCrmLink)
      .where(eq(schema.marketplaceCrmLink.creatorUserId, creatorUserId));
    return rows.map((row) => row.listingId);
  }

  async hasApplied(listingId: string, creatorUserId: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: schema.marketplaceApplication.id })
      .from(schema.marketplaceApplication)
      .where(
        and(
          eq(schema.marketplaceApplication.listingId, listingId),
          eq(schema.marketplaceApplication.creatorUserId, creatorUserId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async createApplication(input: {
    listingId: string;
    creatorUserId: string;
    pitch: string;
    addedToCrm: boolean;
  }): Promise<MarketplaceApplicationRecord> {
    const [row] = await this.db
      .insert(schema.marketplaceApplication)
      .values({
        listingId: input.listingId,
        creatorUserId: input.creatorUserId,
        pitch: input.pitch,
        addedToCrm: input.addedToCrm,
      })
      .returning();
    if (input.addedToCrm) {
      await this.linkCrm(input.creatorUserId, input.listingId);
    }
    return {
      id: row.id,
      listingId: row.listingId,
      pitch: row.pitch,
      appliedAt: row.appliedAt.toISOString(),
      addedToCrm: row.addedToCrm,
      status: row.status as MarketplaceApplicationRecord['status'],
    };
  }

  async getApplicationById(applicationId: string): Promise<
    | (MarketplaceApplicationRecord & {
        creatorUserId: string;
        creatorEmail: string;
        creatorName: string;
      })
    | null
  > {
    const [row] = await this.db
      .select({
        id: schema.marketplaceApplication.id,
        listingId: schema.marketplaceApplication.listingId,
        pitch: schema.marketplaceApplication.pitch,
        appliedAt: schema.marketplaceApplication.appliedAt,
        addedToCrm: schema.marketplaceApplication.addedToCrm,
        status: schema.marketplaceApplication.status,
        creatorUserId: schema.marketplaceApplication.creatorUserId,
        creatorEmail: schema.thesiUser.email,
        creatorName: schema.thesiUser.fullName,
        displayName: schema.creatorProfile.displayName,
      })
      .from(schema.marketplaceApplication)
      .innerJoin(
        schema.thesiUser,
        eq(schema.thesiUser.id, schema.marketplaceApplication.creatorUserId),
      )
      .leftJoin(
        schema.creatorProfile,
        eq(
          schema.creatorProfile.userId,
          schema.marketplaceApplication.creatorUserId,
        ),
      )
      .where(eq(schema.marketplaceApplication.id, applicationId))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      listingId: row.listingId,
      pitch: row.pitch,
      appliedAt: row.appliedAt.toISOString(),
      addedToCrm: row.addedToCrm,
      status: row.status as MarketplaceApplicationRecord['status'],
      creatorUserId: row.creatorUserId,
      creatorEmail: row.creatorEmail,
      creatorName: row.displayName?.trim() || row.creatorName,
    };
  }

  async updateApplicationStatus(
    applicationId: string,
    status: 'accepted' | 'rejected',
  ): Promise<MarketplaceApplicationRecord | null> {
    const [row] = await this.db
      .update(schema.marketplaceApplication)
      .set({ status })
      .where(
        and(
          eq(schema.marketplaceApplication.id, applicationId),
          eq(schema.marketplaceApplication.status, 'pending'),
        ),
      )
      .returning();
    if (!row) return null;
    return {
      id: row.id,
      listingId: row.listingId,
      pitch: row.pitch,
      appliedAt: row.appliedAt.toISOString(),
      addedToCrm: row.addedToCrm,
      status: row.status as MarketplaceApplicationRecord['status'],
    };
  }

  async linkCrm(creatorUserId: string, listingId: string): Promise<void> {
    await this.db
      .insert(schema.marketplaceCrmLink)
      .values({ creatorUserId, listingId })
      .onConflictDoNothing();
  }

  private async countApplicants(listingId: string): Promise<number> {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.marketplaceApplication)
      .where(eq(schema.marketplaceApplication.listingId, listingId));
    return Number(row?.count ?? 0);
  }

  private mapListing(
    row: typeof schema.marketplaceListing.$inferSelect,
    applicantsCount: number,
  ): MarketplaceListingRecord {
    return {
      id: row.id,
      name: row.name,
      brandName: row.brandName,
      ownerUserId: row.ownerUserId,
      campaignId: row.campaignId,
      campaignType:
        row.campaignType as MarketplaceListingRecord['campaignType'],
      contentTypes: Array.isArray(row.contentTypes)
        ? (row.contentTypes as MarketplaceListingRecord['contentTypes'])
        : [],
      status: row.status as MarketplaceListingRecord['status'],
      startDate: row.startDate,
      endDate: row.endDate,
      applicationDeadline: row.applicationDeadline,
      brief: row.brief,
      deliverables: row.deliverables,
      exampleVideoLinks: Array.isArray(row.exampleVideoLinks)
        ? row.exampleVideoLinks.filter(
            (item): item is string => typeof item === 'string',
          )
        : [],
      requirements: Array.isArray(row.requirements) ? row.requirements : [],
      files: Array.isArray(row.files) ? row.files : [],
      payment: row.payment,
      requiredTasks: Array.isArray(row.requiredTasks) ? row.requiredTasks : [],
      creatorBenefits: row.creatorBenefits,
      contentRights: {
        organicUsage: row.contentRights?.organicUsage ?? true,
        websiteAppUsage: row.contentRights?.websiteAppUsage ?? false,
        paidAdsUsage: row.contentRights?.paidAdsUsage ?? false,
        duration: row.contentRights?.duration ?? '',
        rawContentAccess: row.contentRights?.rawContentAccess ?? false,
      },
      productsProvided: Array.isArray(row.productsProvided)
        ? row.productsProvided
        : [],
      location: row.location,
      remoteOk: row.remoteOk,
      slots: row.slots,
      applicantsCount,
      postedAt: row.postedAt.toISOString(),
    };
  }
}
