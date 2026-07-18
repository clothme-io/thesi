import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import type { FileStoragePort } from 'src/shared/storage/file-storage.port';
import type { UpsertCampaignDto } from './dto/campaign.dto';
import type { BillingService } from 'src/api/billing/billing.service';
import type { StripeService } from 'src/shared/stripe/stripe.service';
import type { ConnectService } from 'src/api/connect/connect.service';
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
import { CampaignsService } from './campaigns.service';

class FakeCampaignRepository implements CampaignRepository {
  user: CampaignUser | null = null;
  rows: CampaignRecord[] = [];
  files: CampaignFileRow[] = [];
  fees = new Map<string, CampaignPlatformFeeRecord>();
  payouts = new Map<string, CreatorPayoutRecord>();

  async getUser() {
    return this.user;
  }

  async listByOwner() {
    return this.rows;
  }

  async getByIdForOwner(_ownerUserId: string, campaignId: string) {
    return this.rows.find((row) => row.id === campaignId) ?? null;
  }

  async create(ownerUserId: string, input: UpsertCampaignDto) {
    const now = new Date().toISOString();
    const row: CampaignRecord = {
      id: `${ownerUserId}-campaign-${this.rows.length + 1}`,
      ...input,
      files: [],
      createdAt: now,
      updatedAt: now,
    };
    this.rows.push(row);
    return row;
  }

  async update(
    _ownerUserId: string,
    campaignId: string,
    input: UpsertCampaignDto,
  ) {
    const index = this.rows.findIndex((row) => row.id === campaignId);
    if (index < 0) return null;
    const updated: CampaignRecord = {
      ...this.rows[index],
      ...input,
      files: this.rows[index].files,
      updatedAt: new Date().toISOString(),
    };
    this.rows[index] = updated;
    return updated;
  }

  async createFile(input: CreateCampaignFileInput) {
    const row: CampaignFileRow = {
      id: `file-${this.files.length + 1}`,
      campaignId: input.campaignId,
      ownerUserId: input.ownerUserId,
      originalName: input.originalName,
      sizeBytes: input.sizeBytes,
      contentType: input.contentType,
      storageProvider: input.storageProvider,
      storageKey: input.storageKey,
      createdAt: new Date().toISOString(),
    };
    this.files.push(row);
    return row;
  }

  async listFiles(campaignId: string) {
    return this.files.filter((file) => file.campaignId === campaignId);
  }

  async getFileForOwner(
    ownerUserId: string,
    campaignId: string,
    fileId: string,
  ) {
    return (
      this.files.find(
        (file) =>
          file.id === fileId &&
          file.campaignId === campaignId &&
          file.ownerUserId === ownerUserId,
      ) ?? null
    );
  }

  async deleteFile(ownerUserId: string, campaignId: string, fileId: string) {
    const index = this.files.findIndex(
      (file) =>
        file.id === fileId &&
        file.campaignId === campaignId &&
        file.ownerUserId === ownerUserId,
    );
    if (index < 0) return null;
    const [removed] = this.files.splice(index, 1);
    return removed;
  }

  async syncCampaignFilesJson(campaignId: string, files: CampaignFileMeta[]) {
    const index = this.rows.findIndex((row) => row.id === campaignId);
    if (index >= 0) {
      this.rows[index] = { ...this.rows[index], files };
    }
  }

  async getPlatformFee(campaignId: string) {
    return this.fees.get(campaignId) ?? null;
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
  }) {
    const now = new Date().toISOString();
    const fee: CampaignPlatformFeeRecord = {
      id: `fee-${input.campaignId}`,
      campaignId: input.campaignId,
      brandUserId: input.brandUserId,
      payoutCents: input.payoutCents,
      feeCents: input.feeCents,
      currency: input.currency ?? 'usd',
      status: input.status,
      ...(input.stripePaymentIntentId
        ? { stripePaymentIntentId: input.stripePaymentIntentId }
        : {}),
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    };
    this.fees.set(input.campaignId, fee);
    return fee;
  }

  async getCreatorPayout(campaignId: string, creatorUserId: string) {
    return this.payouts.get(`${campaignId}:${creatorUserId}`) ?? null;
  }

  async listCreatorPayoutsForCampaign(campaignId: string) {
    return [...this.payouts.values()].filter((p) => p.campaignId === campaignId);
  }

  async listCreatorPayoutsForCreator(creatorUserId: string) {
    return [...this.payouts.values()].filter(
      (p) => p.creatorUserId === creatorUserId,
    );
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
    const now = new Date().toISOString();
    const payout: CreatorPayoutRecord = {
      id: `payout-${input.campaignId}-${input.creatorUserId}`,
      campaignId: input.campaignId,
      brandUserId: input.brandUserId,
      creatorUserId: input.creatorUserId,
      amountCents: input.amountCents,
      currency: input.currency ?? 'usd',
      status: input.status,
      ...(input.stripePaymentIntentId
        ? { stripePaymentIntentId: input.stripePaymentIntentId }
        : {}),
      ...(input.stripeTransferId
        ? { stripeTransferId: input.stripeTransferId }
        : {}),
      stripeDestinationAccountId: input.stripeDestinationAccountId,
      idempotencyKey: input.idempotencyKey,
      ...(input.failureReason ? { failureReason: input.failureReason } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.payouts.set(`${input.campaignId}:${input.creatorUserId}`, payout);
    return payout;
  }
}

class FakeFileStorage implements FileStoragePort {
  stored = new Map<string, Buffer>();

  async upload(file: { buffer: Buffer }, key: string) {
    this.stored.set(key, file.buffer);
    return { provider: 'local' as const, key };
  }

  async read(ref: { key: string }) {
    const buffer = this.stored.get(ref.key);
    if (!buffer) throw new Error('missing');
    return buffer;
  }

  async delete(ref: { key: string }) {
    this.stored.delete(ref.key);
  }
}

describe('CampaignsService', () => {
  let repository: FakeCampaignRepository;
  let storage: FakeFileStorage;
  let service: CampaignsService;
  let billing: {
    resolveChargeContext: jest.Mock;
    recordPlatformFeeInvoice: jest.Mock;
  };
  let stripe: { chargeOffSession: jest.Mock; createTransfer: jest.Mock };
  let connect: { getCreatorPayoutReadiness: jest.Mock };

  beforeEach(() => {
    repository = new FakeCampaignRepository();
    storage = new FakeFileStorage();
    billing = {
      resolveChargeContext: jest.fn().mockResolvedValue({
        customerId: 'cus_local_1',
        paymentMethodId: 'pm_local_default',
        stripeConfigured: false,
      }),
      recordPlatformFeeInvoice: jest.fn().mockResolvedValue(undefined),
    };
    stripe = {
      chargeOffSession: jest.fn().mockResolvedValue({
        paymentIntentId: 'pi_local_1',
        status: 'succeeded',
      }),
      createTransfer: jest.fn().mockResolvedValue({ transferId: 'tr_local_1' }),
    };
    connect = {
      getCreatorPayoutReadiness: jest.fn().mockResolvedValue({
        ready: true,
        accountId: 'acct_local_creator',
      }),
    };
    service = new CampaignsService(
      repository,
      storage,
      billing as unknown as BillingService,
      stripe as unknown as StripeService,
      connect as unknown as ConnectService,
    );
  });

  it('lists campaigns for a brand', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };
    await service.create('brand-1', sampleCampaign({ name: 'Summer UGC' }));

    await expect(service.list('brand-1')).resolves.toEqual({
      campaigns: [
        expect.objectContaining({
          name: 'Summer UGC',
          status: 'draft',
        }),
      ],
    });
  });

  it('rejects invalid date ranges', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };

    await expect(
      service.create(
        'brand-1',
        sampleCampaign({ startDate: '2026-08-01', endDate: '2026-07-01' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents creators from managing campaigns', async () => {
    repository.user = { id: 'creator-1', role: 'creator' };

    await expect(service.list('creator-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('returns not found for missing campaigns', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };

    await expect(service.get('brand-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('uploads a campaign file and keeps metadata on the campaign', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };
    const campaign = await service.create('brand-1', sampleCampaign());

    const meta = await service.uploadFile('brand-1', campaign.id, {
      buffer: Buffer.from('hello'),
      originalname: 'brief.pdf',
      mimetype: 'application/pdf',
      size: 5,
    });

    expect(meta).toEqual(
      expect.objectContaining({
        name: 'brief.pdf',
        sizeLabel: '5 B',
      }),
    );
    await expect(service.get('brand-1', campaign.id)).resolves.toEqual(
      expect.objectContaining({
        files: [expect.objectContaining({ name: 'brief.pdf' })],
      }),
    );
  });

  it('rejects oversized uploads', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };
    const campaign = await service.create('brand-1', sampleCampaign());

    await expect(
      service.uploadFile('brand-1', campaign.id, {
        buffer: Buffer.alloc(10),
        originalname: 'big.bin',
        mimetype: 'application/pdf',
        size: 26 * 1024 * 1024,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('collects a platform fee when activating a campaign', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };
    const campaign = await service.create(
      'brand-1',
      sampleCampaign({
        status: 'active',
        postToMarketplace: true,
        payment: { model: 'flat_rate', flatRateCents: 100_000 },
      }),
    );

    expect(campaign.status).toBe('active');
    expect(stripe.chargeOffSession).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 2_000 }),
    );
    expect(repository.fees.get(campaign.id)?.status).toBe('paid');
    expect(billing.recordPlatformFeeInvoice).toHaveBeenCalled();
  });

  it('requires a default card when Stripe charge context is missing', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };
    billing.resolveChargeContext.mockResolvedValue(null);

    await expect(
      service.create(
        'brand-1',
        sampleCampaign({
          status: 'active',
          payment: { model: 'flat_rate', flatRateCents: 50_000 },
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('charges the brand and transfers to a ready creator', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };
    const campaign = await service.create(
      'brand-1',
      sampleCampaign({
        payment: { model: 'flat_rate', flatRateCents: 80_000 },
      }),
    );

    const payout = await service.payCreator('brand-1', campaign.id, {
      creatorUserId: 'creator-9',
    });

    expect(payout.status).toBe('transferred');
    expect(payout.amountCents).toBe(80_000);
    expect(stripe.createTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 80_000,
        destinationAccountId: 'acct_local_creator',
      }),
    );
  });

  it('blocks payouts when the creator is not Connect-ready', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };
    connect.getCreatorPayoutReadiness.mockResolvedValue({
      ready: false,
      accountId: null,
      reason: 'Creator must finish Stripe payout setup',
    });
    const campaign = await service.create('brand-1', sampleCampaign());

    await expect(
      service.payCreator('brand-1', campaign.id, {
        creatorUserId: 'creator-9',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

function sampleCampaign(
  overrides: Partial<UpsertCampaignDto> = {},
): UpsertCampaignDto {
  return {
    name: 'Untitled campaign',
    type: 'tiktok',
    status: 'draft',
    startDate: '2026-07-01',
    endDate: '2026-08-01',
    brief: 'Brief',
    deliverables: '1 video',
    requirements: {
      niches: ['Fitness'],
      minFollowersRange: '5k+',
      location: 'US',
      platforms: ['TikTok'],
    },
    files: [],
    payment: {
      model: 'flat_rate',
      flatRateCents: 25000,
    },
    postToMarketplace: false,
    ...overrides,
  };
}
