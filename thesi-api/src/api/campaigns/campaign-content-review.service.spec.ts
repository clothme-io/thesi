import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import type { FileStoragePort } from 'src/shared/storage/file-storage.port';
import { CampaignContentReviewService } from './campaign-content-review.service';
import type {
  CampaignContentReviewEventRow,
  CampaignContentReviewRepository,
  CampaignContentSubmissionRow,
} from './campaign-content-review.repository';

class FakeReviewRepository implements CampaignContentReviewRepository {
  campaign = {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'Summer Drop',
    ownerUserId: 'brand-1',
  };
  listingId: string | null = 'listing-1';
  accepted = new Set<string>(['creator-1']);
  users = new Map([
    ['creator-1', { id: 'creator-1', role: 'creator', fullName: 'Ava Chen' }],
    ['brand-1', { id: 'brand-1', role: 'brand', fullName: 'Northwind' }],
  ]);
  submissions: CampaignContentSubmissionRow[] = [];
  events: CampaignContentReviewEventRow[] = [];

  async getCampaign(campaignId: string) {
    return campaignId === this.campaign.id ? this.campaign : null;
  }
  async listingIdForCampaign() {
    return this.listingId;
  }
  async creatorAccepted(creatorUserId: string, campaignId: string) {
    return campaignId === this.campaign.id && this.accepted.has(creatorUserId);
  }
  async getUser(userId: string) {
    return this.users.get(userId) ?? null;
  }
  async listSubmissions(campaignId: string, creatorUserId?: string) {
    return this.submissions.filter(
      (row) =>
        row.campaignId === campaignId &&
        (!creatorUserId || row.creatorUserId === creatorUserId),
    );
  }
  async getSubmission(campaignId: string, submissionId: string) {
    return (
      this.submissions.find(
        (row) => row.campaignId === campaignId && row.id === submissionId,
      ) ?? null
    );
  }
  async findSlot(
    campaignId: string,
    creatorUserId: string,
    deliverableLabel: string,
  ) {
    return (
      this.submissions.find(
        (row) =>
          row.campaignId === campaignId &&
          row.creatorUserId === creatorUserId &&
          row.deliverableLabel.toLowerCase() === deliverableLabel.toLowerCase(),
      ) ?? null
    );
  }
  async insertSubmission(input: {
    campaignId: string;
    creatorUserId: string;
    deliverableLabel: string;
    title: string;
    originalName: string;
    sizeBytes: number;
    contentType: string;
    storageProvider: 'local' | 'bunny';
    storageKey: string;
  }) {
    const row: CampaignContentSubmissionRow = {
      id: `sub-${this.submissions.length + 1}`,
      campaignId: input.campaignId,
      creatorUserId: input.creatorUserId,
      creatorName: this.users.get(input.creatorUserId)?.fullName || 'Creator',
      deliverableLabel: input.deliverableLabel,
      title: input.title,
      status: 'draft',
      version: 1,
      originalName: input.originalName,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
      storageProvider: input.storageProvider,
      storageKey: input.storageKey,
      reviewedByUserId: null,
      submittedAt: null,
      reviewedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.submissions.push(row);
    return row;
  }
  async updateSubmissionFile(
    submissionId: string,
    input: {
      title?: string;
      originalName: string;
      sizeBytes: number;
      contentType: string;
      storageProvider: 'local' | 'bunny';
      storageKey: string;
      version: number;
      status: CampaignContentSubmissionRow['status'];
    },
  ) {
    const row = this.submissions.find((item) => item.id === submissionId);
    if (!row) return null;
    Object.assign(row, input, {
      title: input.title ?? row.title,
      submittedAt: null,
      reviewedAt: null,
      reviewedByUserId: null,
      updatedAt: new Date(),
    });
    return row;
  }
  async updateStatus(
    submissionId: string,
    patch: Partial<CampaignContentSubmissionRow> & {
      status: CampaignContentSubmissionRow['status'];
    },
  ) {
    const row = this.submissions.find((item) => item.id === submissionId);
    if (!row) return null;
    Object.assign(row, patch, { updatedAt: new Date() });
    return row;
  }
  async listEvents(submissionId: string) {
    return this.events.filter((event) => event.submissionId === submissionId);
  }
  async addEvent(input: {
    submissionId: string;
    actorUserId: string;
    type: CampaignContentReviewEventRow['type'];
    comment: string;
    version: number;
  }) {
    const event: CampaignContentReviewEventRow = {
      id: `evt-${this.events.length + 1}`,
      actorName: this.users.get(input.actorUserId)?.fullName || 'Member',
      createdAt: new Date(),
      ...input,
    };
    this.events.push(event);
    return event;
  }
}

describe('CampaignContentReviewService', () => {
  const campaignId = '11111111-1111-1111-1111-111111111111';
  let repository: FakeReviewRepository;
  let stored: string[];
  let inbox: { createNotificationForUser: jest.Mock };
  let service: CampaignContentReviewService;

  beforeEach(() => {
    repository = new FakeReviewRepository();
    stored = [];
    inbox = { createNotificationForUser: jest.fn().mockResolvedValue({}) };
    const storage = {
      upload: jest.fn(async (_file, key: string) => {
        stored.push(key);
        return { provider: 'local' as const, key };
      }),
      read: jest.fn(async () => Buffer.from('video')),
      delete: jest.fn(async (ref: { key: string }) => {
        stored = stored.filter((key) => key !== ref.key);
      }),
    } as unknown as FileStoragePort;
    service = new CampaignContentReviewService(
      repository,
      storage,
      inbox as never,
    );
  });

  function mp4() {
    return {
      buffer: Buffer.from('video'),
      originalname: 'draft.mp4',
      mimetype: 'video/mp4',
      size: 12,
    };
  }

  it('blocks upload until the creator accepted the campaign', async () => {
    await expect(
      service.upload('creator-2', 'creator', campaignId, mp4(), {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets an accepted creator upload and submit a playable draft', async () => {
    const { item } = await service.upload('creator-1', 'creator', campaignId, mp4(), {
      deliverableLabel: 'TikTok 1',
      title: 'Fit check',
    });
    expect(item.status).toBe('draft');
    expect(item.mediaKind).toBe('video');
    const submitted = await service.submit(
      'creator-1',
      'creator',
      campaignId,
      item.id,
    );
    expect(submitted.item.status).toBe('in_review');
    expect(inbox.createNotificationForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'brand-1',
        audience: 'brand',
        type: 'campaign_update',
      }),
    );
  });

  it('rejects non-media uploads', async () => {
    await expect(
      service.upload(
        'creator-1',
        'creator',
        campaignId,
        {
          buffer: Buffer.from('pdf'),
          originalname: 'brief.pdf',
          mimetype: 'application/pdf',
          size: 12,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lets the brand request changes with a comment', async () => {
    const { item } = await service.upload('creator-1', 'creator', campaignId, mp4(), {
      deliverableLabel: 'Reel',
    });
    await service.submit('creator-1', 'creator', campaignId, item.id);
    const decided = await service.requestChanges(
      'brand-1',
      'brand',
      campaignId,
      item.id,
      'Crop the first two seconds.',
    );
    expect(decided.item.status).toBe('changes_requested');
    expect(inbox.createNotificationForUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'creator-1',
        audience: 'creator',
      }),
    );
  });

  it('requires a comment to reject', async () => {
    const { item } = await service.upload('creator-1', 'creator', campaignId, mp4(), {});
    await service.submit('creator-1', 'creator', campaignId, item.id);
    await expect(
      service.reject('brand-1', 'brand', campaignId, item.id, '  '),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
