import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type {
  CampaignContentReviewEventType,
  CampaignContentReviewStatus,
} from 'src/dbConfig/drizzle/schema/campaignSchema';

export const CAMPAIGN_CONTENT_REVIEW_REPOSITORY = Symbol(
  'CAMPAIGN_CONTENT_REVIEW_REPOSITORY',
);

export type CampaignContentSubmissionRow = {
  id: string;
  campaignId: string;
  creatorUserId: string;
  creatorName: string;
  deliverableLabel: string;
  title: string;
  status: CampaignContentReviewStatus;
  version: number;
  originalName: string;
  sizeBytes: number;
  contentType: string;
  storageProvider: 'local' | 'bunny';
  storageKey: string;
  reviewedByUserId: string | null;
  submittedAt: Date | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CampaignContentReviewEventRow = {
  id: string;
  submissionId: string;
  actorUserId: string;
  actorName: string;
  type: CampaignContentReviewEventType;
  comment: string;
  version: number;
  createdAt: Date;
};

export type CreateSubmissionInput = {
  campaignId: string;
  creatorUserId: string;
  deliverableLabel: string;
  title: string;
  originalName: string;
  sizeBytes: number;
  contentType: string;
  storageProvider: 'local' | 'bunny';
  storageKey: string;
};

export type UpdateSubmissionFileInput = {
  title?: string;
  originalName: string;
  sizeBytes: number;
  contentType: string;
  storageProvider: 'local' | 'bunny';
  storageKey: string;
  version: number;
  status: CampaignContentReviewStatus;
};

export interface CampaignContentReviewRepository {
  getCampaign(campaignId: string): Promise<{
    id: string;
    name: string;
    ownerUserId: string;
  } | null>;
  listingIdForCampaign(campaignId: string): Promise<string | null>;
  creatorAccepted(creatorUserId: string, campaignId: string): Promise<boolean>;
  getUser(
    userId: string,
  ): Promise<{ id: string; role: string; fullName: string } | null>;
  listSubmissions(
    campaignId: string,
    creatorUserId?: string,
  ): Promise<CampaignContentSubmissionRow[]>;
  getSubmission(
    campaignId: string,
    submissionId: string,
  ): Promise<CampaignContentSubmissionRow | null>;
  findSlot(
    campaignId: string,
    creatorUserId: string,
    deliverableLabel: string,
  ): Promise<CampaignContentSubmissionRow | null>;
  insertSubmission(
    input: CreateSubmissionInput,
  ): Promise<CampaignContentSubmissionRow>;
  updateSubmissionFile(
    submissionId: string,
    input: UpdateSubmissionFileInput,
  ): Promise<CampaignContentSubmissionRow | null>;
  updateStatus(
    submissionId: string,
    patch: {
      status: CampaignContentReviewStatus;
      reviewedByUserId?: string | null;
      submittedAt?: Date | null;
      reviewedAt?: Date | null;
    },
  ): Promise<CampaignContentSubmissionRow | null>;
  listEvents(submissionId: string): Promise<CampaignContentReviewEventRow[]>;
  addEvent(input: {
    submissionId: string;
    actorUserId: string;
    type: CampaignContentReviewEventType;
    comment: string;
    version: number;
  }): Promise<CampaignContentReviewEventRow>;
}

@Injectable()
export class PostgresCampaignContentReviewRepository
  implements CampaignContentReviewRepository
{
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getCampaign(campaignId: string) {
    const [row] = await this.db
      .select({
        id: schema.campaign.id,
        name: schema.campaign.name,
        ownerUserId: schema.campaign.ownerUserId,
      })
      .from(schema.campaign)
      .where(eq(schema.campaign.id, campaignId))
      .limit(1);
    return row ?? null;
  }

  async listingIdForCampaign(campaignId: string) {
    const [row] = await this.db
      .select({ id: schema.marketplaceListing.id })
      .from(schema.marketplaceListing)
      .where(eq(schema.marketplaceListing.campaignId, campaignId))
      .limit(1);
    return row?.id ?? null;
  }

  async creatorAccepted(creatorUserId: string, campaignId: string) {
    const [row] = await this.db
      .select({ id: schema.campaignAcceptanceSnapshot.id })
      .from(schema.campaignAcceptanceSnapshot)
      .where(
        and(
          eq(schema.campaignAcceptanceSnapshot.campaignId, campaignId),
          eq(schema.campaignAcceptanceSnapshot.creatorUserId, creatorUserId),
        ),
      )
      .limit(1);
    return Boolean(row);
  }

  async getUser(userId: string) {
    const [row] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
        fullName: schema.thesiUser.fullName,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return row ?? null;
  }

  async listSubmissions(campaignId: string, creatorUserId?: string) {
    const filters = [
      eq(schema.campaignContentSubmission.campaignId, campaignId),
    ];
    if (creatorUserId) {
      filters.push(
        eq(schema.campaignContentSubmission.creatorUserId, creatorUserId),
      );
    }
    const rows = await this.db
      .select({
        submission: schema.campaignContentSubmission,
        creatorName: schema.thesiUser.fullName,
      })
      .from(schema.campaignContentSubmission)
      .innerJoin(
        schema.thesiUser,
        eq(schema.thesiUser.id, schema.campaignContentSubmission.creatorUserId),
      )
      .where(and(...filters))
      .orderBy(desc(schema.campaignContentSubmission.updatedAt));
    return rows.map((row) => mapSubmission(row.submission, row.creatorName));
  }

  async getSubmission(campaignId: string, submissionId: string) {
    const [row] = await this.db
      .select({
        submission: schema.campaignContentSubmission,
        creatorName: schema.thesiUser.fullName,
      })
      .from(schema.campaignContentSubmission)
      .innerJoin(
        schema.thesiUser,
        eq(schema.thesiUser.id, schema.campaignContentSubmission.creatorUserId),
      )
      .where(
        and(
          eq(schema.campaignContentSubmission.id, submissionId),
          eq(schema.campaignContentSubmission.campaignId, campaignId),
        ),
      )
      .limit(1);
    return row ? mapSubmission(row.submission, row.creatorName) : null;
  }

  async findSlot(
    campaignId: string,
    creatorUserId: string,
    deliverableLabel: string,
  ) {
    const [row] = await this.db
      .select({
        submission: schema.campaignContentSubmission,
        creatorName: schema.thesiUser.fullName,
      })
      .from(schema.campaignContentSubmission)
      .innerJoin(
        schema.thesiUser,
        eq(schema.thesiUser.id, schema.campaignContentSubmission.creatorUserId),
      )
      .where(
        and(
          eq(schema.campaignContentSubmission.campaignId, campaignId),
          eq(schema.campaignContentSubmission.creatorUserId, creatorUserId),
          sql`lower(${schema.campaignContentSubmission.deliverableLabel}) = ${deliverableLabel.toLowerCase()}`,
        ),
      )
      .limit(1);
    return row ? mapSubmission(row.submission, row.creatorName) : null;
  }

  async insertSubmission(input: CreateSubmissionInput) {
    const [inserted] = await this.db
      .insert(schema.campaignContentSubmission)
      .values({
        campaignId: input.campaignId,
        creatorUserId: input.creatorUserId,
        deliverableLabel: input.deliverableLabel,
        title: input.title,
        status: 'draft',
        version: 1,
        originalName: input.originalName,
        sizeBytes: input.sizeBytes,
        contentType: input.contentType,
        storageProvider: input.storageProvider,
        storageKey: input.storageKey,
      })
      .returning();
    const user = await this.getUser(input.creatorUserId);
    return mapSubmission(inserted, user?.fullName || 'Creator');
  }

  async updateSubmissionFile(
    submissionId: string,
    input: UpdateSubmissionFileInput,
  ) {
    const [updated] = await this.db
      .update(schema.campaignContentSubmission)
      .set({
        ...(input.title !== undefined ? { title: input.title } : {}),
        originalName: input.originalName,
        sizeBytes: input.sizeBytes,
        contentType: input.contentType,
        storageProvider: input.storageProvider,
        storageKey: input.storageKey,
        version: input.version,
        status: input.status,
        submittedAt: null,
        reviewedAt: null,
        reviewedByUserId: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.campaignContentSubmission.id, submissionId))
      .returning();
    if (!updated) return null;
    const user = await this.getUser(updated.creatorUserId);
    return mapSubmission(updated, user?.fullName || 'Creator');
  }

  async updateStatus(
    submissionId: string,
    patch: {
      status: CampaignContentReviewStatus;
      reviewedByUserId?: string | null;
      submittedAt?: Date | null;
      reviewedAt?: Date | null;
    },
  ) {
    const [updated] = await this.db
      .update(schema.campaignContentSubmission)
      .set({
        status: patch.status,
        ...(patch.reviewedByUserId !== undefined
          ? { reviewedByUserId: patch.reviewedByUserId }
          : {}),
        ...(patch.submittedAt !== undefined
          ? { submittedAt: patch.submittedAt }
          : {}),
        ...(patch.reviewedAt !== undefined ? { reviewedAt: patch.reviewedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(schema.campaignContentSubmission.id, submissionId))
      .returning();
    if (!updated) return null;
    const user = await this.getUser(updated.creatorUserId);
    return mapSubmission(updated, user?.fullName || 'Creator');
  }

  async listEvents(submissionId: string) {
    const rows = await this.db
      .select({
        event: schema.campaignContentReviewEvent,
        actorName: schema.thesiUser.fullName,
      })
      .from(schema.campaignContentReviewEvent)
      .innerJoin(
        schema.thesiUser,
        eq(schema.thesiUser.id, schema.campaignContentReviewEvent.actorUserId),
      )
      .where(eq(schema.campaignContentReviewEvent.submissionId, submissionId))
      .orderBy(schema.campaignContentReviewEvent.createdAt);
    return rows.map((row) => mapEvent(row.event, row.actorName));
  }

  async addEvent(input: {
    submissionId: string;
    actorUserId: string;
    type: CampaignContentReviewEventType;
    comment: string;
    version: number;
  }) {
    const [inserted] = await this.db
      .insert(schema.campaignContentReviewEvent)
      .values({
        submissionId: input.submissionId,
        actorUserId: input.actorUserId,
        type: input.type,
        comment: input.comment,
        version: input.version,
      })
      .returning();
    const user = await this.getUser(input.actorUserId);
    return mapEvent(inserted, user?.fullName || 'Member');
  }
}

function mapSubmission(
  row: typeof schema.campaignContentSubmission.$inferSelect,
  creatorName: string,
): CampaignContentSubmissionRow {
  return {
    id: row.id,
    campaignId: row.campaignId,
    creatorUserId: row.creatorUserId,
    creatorName,
    deliverableLabel: row.deliverableLabel,
    title: row.title,
    status: row.status as CampaignContentReviewStatus,
    version: row.version,
    originalName: row.originalName,
    sizeBytes: row.sizeBytes,
    contentType: row.contentType,
    storageProvider: row.storageProvider as 'local' | 'bunny',
    storageKey: row.storageKey,
    reviewedByUserId: row.reviewedByUserId,
    submittedAt: row.submittedAt,
    reviewedAt: row.reviewedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapEvent(
  row: typeof schema.campaignContentReviewEvent.$inferSelect,
  actorName: string,
): CampaignContentReviewEventRow {
  return {
    id: row.id,
    submissionId: row.submissionId,
    actorUserId: row.actorUserId,
    actorName,
    type: row.type as CampaignContentReviewEventType,
    comment: row.comment,
    version: row.version,
    createdAt: row.createdAt,
  };
}
