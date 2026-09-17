import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { InboxService } from '../inbox/inbox.service';
import {
  FILE_STORAGE,
  type FileStoragePort,
  type UploadableFile,
} from 'src/shared/storage/file-storage.port';
import { formatSizeLabel, sanitizeFileName } from 'src/shared/storage/file-helpers';
import {
  CAMPAIGN_CONTENT_REVIEW_REPOSITORY,
  type CampaignContentReviewEventRow,
  type CampaignContentReviewRepository,
  type CampaignContentSubmissionRow,
} from './campaign-content-review.repository';

export const MAX_REVIEW_FILE_BYTES = 100 * 1024 * 1024;

const VIDEO_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
const IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export type CampaignContentReviewDto = {
  id: string;
  campaignId: string;
  creatorUserId: string;
  creatorName: string;
  deliverableLabel: string;
  title: string;
  status: CampaignContentSubmissionRow['status'];
  version: number;
  originalName: string;
  sizeLabel: string;
  contentType: string;
  mediaKind: 'video' | 'image';
  submittedAt: string | null;
  reviewedAt: string | null;
  updatedAt: string;
  events?: Array<{
    id: string;
    type: CampaignContentReviewEventRow['type'];
    comment: string;
    actorName: string;
    version: number;
    createdAt: string;
  }>;
};

@Injectable()
export class CampaignContentReviewService {
  constructor(
    @Inject(CAMPAIGN_CONTENT_REVIEW_REPOSITORY)
    private readonly reviews: CampaignContentReviewRepository,
    @Inject(FILE_STORAGE)
    private readonly storage: FileStoragePort,
    private readonly inbox: InboxService,
  ) {}

  async list(userId: string, role: string, campaignId: string) {
    await this.assertAccess(userId, role, campaignId);
    const creatorOnly = role === 'brand' ? undefined : userId;
    const rows = await this.reviews.listSubmissions(campaignId, creatorOnly);
    return { items: rows.map((row) => toDto(row)) };
  }

  async get(userId: string, role: string, campaignId: string, submissionId: string) {
    const row = await this.requireReadable(userId, role, campaignId, submissionId);
    const events = await this.reviews.listEvents(row.id);
    return { item: toDto(row, events) };
  }

  async upload(
    userId: string,
    role: string,
    campaignId: string,
    file: UploadableFile | undefined,
    fields: { title?: string; deliverableLabel?: string },
  ) {
    if (role === 'brand') {
      throw new ForbiddenException('Creators submit drafts for review');
    }
    await this.assertCreatorAccepted(userId, campaignId);
    const stored = await this.storeFile(userId, campaignId, file);
    const label = (fields.deliverableLabel || 'Draft').trim().slice(0, 80);
    const title = (fields.title || stored.originalName).trim().slice(0, 120);
    const existing = await this.reviews.findSlot(campaignId, userId, label);
    if (existing) {
      if (existing.status === 'in_review' || existing.status === 'approved') {
        await this.storage.delete(stored.ref);
        throw new BadRequestException(
          existing.status === 'approved'
            ? 'This deliverable is already approved'
            : 'This deliverable is waiting on the brand. Wait for a decision before replacing it.',
        );
      }
      const previous = {
        provider: existing.storageProvider,
        key: existing.storageKey,
      } as const;
      const updated = await this.reviews.updateSubmissionFile(existing.id, {
        title,
        originalName: stored.originalName,
        sizeBytes: stored.sizeBytes,
        contentType: stored.contentType,
        storageProvider: stored.ref.provider,
        storageKey: stored.ref.key,
        version: existing.version + 1,
        status: 'draft',
      });
      await this.storage.delete(previous).catch(() => undefined);
      return { item: toDto(updated!) };
    }
    const created = await this.reviews.insertSubmission({
      campaignId,
      creatorUserId: userId,
      deliverableLabel: label,
      title,
      originalName: stored.originalName,
      sizeBytes: stored.sizeBytes,
      contentType: stored.contentType,
      storageProvider: stored.ref.provider,
      storageKey: stored.ref.key,
    });
    return { item: toDto(created) };
  }

  async submit(userId: string, role: string, campaignId: string, submissionId: string) {
    if (role === 'brand') {
      throw new ForbiddenException('Creators submit drafts for review');
    }
    const row = await this.requireReadable(userId, role, campaignId, submissionId);
    if (row.status !== 'draft' && row.status !== 'changes_requested') {
      throw new BadRequestException('Only drafts and change requests can be submitted');
    }
    const updated = await this.reviews.updateStatus(row.id, {
      status: 'in_review',
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedByUserId: null,
    });
    await this.reviews.addEvent({
      submissionId: row.id,
      actorUserId: userId,
      type: 'submitted',
      comment: '',
      version: row.version,
    });
    await this.notifyBrand(campaignId, {
      title: `Draft ready: ${row.title || row.deliverableLabel || 'Campaign draft'}`,
      body: `${row.creatorName} submitted content for "${(await this.reviews.getCampaign(campaignId))?.name ?? 'campaign'}".`,
    });
    const events = await this.reviews.listEvents(row.id);
    return { item: toDto(updated!, events) };
  }

  async revise(
    userId: string,
    role: string,
    campaignId: string,
    submissionId: string,
    file: UploadableFile | undefined,
    fields: { title?: string; comment?: string },
  ) {
    if (role === 'brand') {
      throw new ForbiddenException('Creators submit revisions');
    }
    const row = await this.requireReadable(userId, role, campaignId, submissionId);
    if (row.status !== 'draft' && row.status !== 'changes_requested') {
      throw new BadRequestException('This draft cannot be replaced right now');
    }
    const stored = await this.storeFile(userId, campaignId, file);
    const previous = {
      provider: row.storageProvider,
      key: row.storageKey,
    } as const;
    const updated = await this.reviews.updateSubmissionFile(row.id, {
      title: fields.title?.trim() ? fields.title.trim().slice(0, 120) : row.title,
      originalName: stored.originalName,
      sizeBytes: stored.sizeBytes,
      contentType: stored.contentType,
      storageProvider: stored.ref.provider,
      storageKey: stored.ref.key,
      version: row.version + 1,
      status: 'draft',
    });
    await this.storage.delete(previous).catch(() => undefined);
    if (fields.comment?.trim()) {
      await this.reviews.addEvent({
        submissionId: row.id,
        actorUserId: userId,
        type: 'comment',
        comment: fields.comment.trim().slice(0, 4000),
        version: row.version + 1,
      });
    }
    const events = await this.reviews.listEvents(row.id);
    return { item: toDto(updated!, events) };
  }

  async approve(
    userId: string,
    role: string,
    campaignId: string,
    submissionId: string,
    comment?: string,
  ) {
    return this.decide(userId, role, campaignId, submissionId, 'approved', comment ?? '');
  }

  async requestChanges(
    userId: string,
    role: string,
    campaignId: string,
    submissionId: string,
    comment: string,
  ) {
    if (!comment.trim()) {
      throw new BadRequestException('Describe the changes you need');
    }
    return this.decide(
      userId,
      role,
      campaignId,
      submissionId,
      'changes_requested',
      comment,
    );
  }

  async reject(
    userId: string,
    role: string,
    campaignId: string,
    submissionId: string,
    comment: string,
  ) {
    if (!comment.trim()) {
      throw new BadRequestException('Say why this draft is rejected');
    }
    return this.decide(userId, role, campaignId, submissionId, 'rejected', comment);
  }

  async comment(
    userId: string,
    role: string,
    campaignId: string,
    submissionId: string,
    comment: string,
  ) {
    if (!comment.trim()) {
      throw new BadRequestException('Comment is required');
    }
    const row = await this.requireReadable(userId, role, campaignId, submissionId);
    await this.reviews.addEvent({
      submissionId: row.id,
      actorUserId: userId,
      type: 'comment',
      comment: comment.trim().slice(0, 4000),
      version: row.version,
    });
    const events = await this.reviews.listEvents(row.id);
    return { item: toDto(row, events) };
  }

  async media(
    userId: string,
    role: string,
    campaignId: string,
    submissionId: string,
  ) {
    const row = await this.requireReadable(userId, role, campaignId, submissionId);
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

  private async decide(
    userId: string,
    role: string,
    campaignId: string,
    submissionId: string,
    status: 'approved' | 'changes_requested' | 'rejected',
    comment: string,
  ) {
    if (role !== 'brand') {
      throw new ForbiddenException('Brands review submitted drafts');
    }
    const row = await this.requireReadable(userId, role, campaignId, submissionId);
    if (row.status !== 'in_review') {
      throw new BadRequestException('Only drafts in review can be decided');
    }
    const eventType =
      status === 'approved'
        ? 'approved'
        : status === 'rejected'
          ? 'rejected'
          : 'changes_requested';
    const updated = await this.reviews.updateStatus(row.id, {
      status,
      reviewedByUserId: userId,
      reviewedAt: new Date(),
    });
    await this.reviews.addEvent({
      submissionId: row.id,
      actorUserId: userId,
      type: eventType,
      comment: comment.trim().slice(0, 4000),
      version: row.version,
    });
    const campaign = await this.reviews.getCampaign(campaignId);
    const listingId = await this.reviews.listingIdForCampaign(campaignId);
    const href = listingId
      ? `/app/marketplace/${listingId}`
      : '/app/inbox';
    await this.inbox.createNotificationForUser({
      userId: row.creatorUserId,
      type: 'campaign_update',
      title:
        status === 'approved'
          ? `Approved: ${row.title || campaign?.name || 'draft'}`
          : status === 'rejected'
            ? `Rejected: ${row.title || campaign?.name || 'draft'}`
            : `Changes requested: ${row.title || campaign?.name || 'draft'}`,
      body:
        comment.trim() ||
        (status === 'approved'
          ? `${campaign?.name ?? 'The brand'} approved your draft.`
          : status === 'rejected'
            ? `${campaign?.name ?? 'The brand'} rejected this draft.`
            : `${campaign?.name ?? 'The brand'} asked for changes.`),
      href,
      campaignId,
      audience: 'creator',
    });
    const events = await this.reviews.listEvents(row.id);
    return { item: toDto(updated!, events) };
  }

  private async notifyBrand(
    campaignId: string,
    input: { title: string; body: string },
  ) {
    const campaign = await this.reviews.getCampaign(campaignId);
    if (!campaign) return;
    await this.inbox.createNotificationForUser({
      userId: campaign.ownerUserId,
      type: 'campaign_update',
      title: input.title,
      body: input.body,
      href: `/app/campaigns/${campaignId}`,
      campaignId,
      audience: 'brand',
    });
  }

  private async storeFile(
    userId: string,
    campaignId: string,
    file: UploadableFile | undefined,
  ) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('A video or image file is required');
    }
    if (file.size > MAX_REVIEW_FILE_BYTES) {
      throw new BadRequestException('File must be 100MB or smaller');
    }
    const mime = (file.mimetype || '').toLowerCase();
    if (!VIDEO_TYPES.has(mime) && !IMAGE_TYPES.has(mime)) {
      throw new BadRequestException(
        'Use MP4, MOV, WebM, JPEG, PNG, or WebP. This is a draft for review, not a social post.',
      );
    }
    const originalName = sanitizeFileName(file.originalname);
    const key = `campaign-reviews/${campaignId}/${userId}/${randomUUID()}-${originalName}`;
    const ref = await this.storage.upload(file, key);
    return {
      originalName,
      sizeBytes: file.size,
      contentType: mime,
      ref,
    };
  }

  private async assertAccess(userId: string, role: string, campaignId: string) {
    if (role === 'brand') {
      const campaign = await this.reviews.getCampaign(campaignId);
      if (!campaign || campaign.ownerUserId !== userId) {
        throw new ForbiddenException('Campaign not found');
      }
      return campaign;
    }
    await this.assertCreatorAccepted(userId, campaignId);
    return this.reviews.getCampaign(campaignId);
  }

  private async assertCreatorAccepted(userId: string, campaignId: string) {
    const user = await this.reviews.getUser(userId);
    if (!user || user.role !== 'creator') {
      throw new ForbiddenException('Creator account required');
    }
    const accepted = await this.reviews.creatorAccepted(userId, campaignId);
    if (!accepted) {
      throw new ForbiddenException(
        'Accept the campaign before submitting drafts',
      );
    }
  }

  private async requireReadable(
    userId: string,
    role: string,
    campaignId: string,
    submissionId: string,
  ) {
    await this.assertAccess(userId, role, campaignId);
    const row = await this.reviews.getSubmission(campaignId, submissionId);
    if (!row) throw new NotFoundException('Draft not found');
    if (role !== 'brand' && row.creatorUserId !== userId) {
      throw new ForbiddenException('You can only open your own drafts');
    }
    return row;
  }
}

function toDto(
  row: CampaignContentSubmissionRow,
  events?: CampaignContentReviewEventRow[],
): CampaignContentReviewDto {
  return {
    id: row.id,
    campaignId: row.campaignId,
    creatorUserId: row.creatorUserId,
    creatorName: row.creatorName,
    deliverableLabel: row.deliverableLabel,
    title: row.title,
    status: row.status,
    version: row.version,
    originalName: row.originalName,
    sizeLabel: formatSizeLabel(row.sizeBytes),
    contentType: row.contentType,
    mediaKind: row.contentType.startsWith('video/') ? 'video' : 'image',
    submittedAt: row.submittedAt?.toISOString() ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    updatedAt: row.updatedAt.toISOString(),
    ...(events
      ? {
          events: events.map((event) => ({
            id: event.id,
            type: event.type,
            comment: event.comment,
            actorName: event.actorName,
            version: event.version,
            createdAt: event.createdAt.toISOString(),
          })),
        }
      : {}),
  };
}
