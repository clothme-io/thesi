import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type {
  CreatorCrmAggregate,
  CreatorCrmRepository,
  CrmActivityRecord,
  CrmBrandRecord,
  CrmDealRecord,
  CrmJobRecord,
  CrmPaymentRecord,
  CrmTaskRecord,
  CrmUser,
  MarketplaceListingForCrm,
} from './creator-crm.repository';
import { CreatorCrmService } from './creator-crm.service';

class FakeCreatorCrmRepository implements CreatorCrmRepository {
  user: CrmUser | null = {
    id: 'creator-1',
    role: 'creator',
    email: 'creator@example.com',
    fullName: 'E2E Creator',
  };
  brands: CrmBrandRecord[] = [];
  deals: Array<CrmDealRecord & { marketplaceListingId?: string }> = [];
  jobs: CrmJobRecord[] = [];
  payments: CrmPaymentRecord[] = [];
  tasks: CrmTaskRecord[] = [];
  activities: CrmActivityRecord[] = [];
  listings = new Map<string, MarketplaceListingForCrm>();

  async getUser(userId: string) {
    return this.user?.id === userId ? this.user : null;
  }

  async getAggregate(creatorUserId: string): Promise<CreatorCrmAggregate> {
    void creatorUserId;
    return {
      brands: this.brands,
      deals: this.deals.map(
        ({ marketplaceListingId: _listingId, ...deal }) => deal,
      ),
      jobs: this.jobs,
      contracts: [],
      payments: this.payments,
      calendarEvents: [],
      tasks: this.tasks,
      activities: this.activities,
    };
  }

  async findBrandByEmail(_creatorUserId: string, email: string) {
    return (
      this.brands.find((brand) => brand.email.toLowerCase() === email.toLowerCase()) ??
      null
    );
  }

  async createBrand(input: {
    creatorUserId: string;
    name: string;
    contactName: string;
    email: string;
    tags?: string[];
    notes?: string;
  }) {
    const now = new Date().toISOString();
    const brand: CrmBrandRecord = {
      id: `brand-${this.brands.length + 1}`,
      name: input.name,
      contactName: input.contactName,
      email: input.email,
      phone: '',
      website: '',
      relationshipStage: 'prospect',
      tags: input.tags ?? [],
      notes: input.notes ?? '',
      createdAt: now,
      updatedAt: now,
    };
    this.brands.push(brand);
    return brand;
  }

  async getDeal(_creatorUserId: string, dealId: string) {
    return this.deals.find((deal) => deal.id === dealId) ?? null;
  }

  async updateDealStage(
    _creatorUserId: string,
    dealId: string,
    stage: CrmDealRecord['stage'],
  ) {
    const deal = this.deals.find((item) => item.id === dealId);
    if (!deal) return null;
    deal.stage = stage;
    deal.updatedAt = new Date().toISOString();
    return deal;
  }

  async getTask(_creatorUserId: string, taskId: string) {
    return this.tasks.find((task) => task.id === taskId) ?? null;
  }

  async updateTaskStatus(
    _creatorUserId: string,
    taskId: string,
    status: CrmTaskRecord['status'],
  ) {
    const task = this.tasks.find((item) => item.id === taskId);
    if (!task) return null;
    task.status = status;
    return task;
  }

  async createActivity(input: {
    creatorUserId: string;
    brandId?: string | null;
    dealId?: string | null;
    type: CrmActivityRecord['type'];
    message: string;
  }) {
    const activity: CrmActivityRecord = {
      id: `act-${this.activities.length + 1}`,
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.dealId ? { dealId: input.dealId } : {}),
      type: input.type,
      message: input.message,
      createdAt: new Date().toISOString(),
    };
    this.activities.unshift(activity);
    return activity;
  }

  async findDealByListing(_creatorUserId: string, listingId: string) {
    return (
      this.deals.find((deal) => deal.marketplaceListingId === listingId) ?? null
    );
  }

  async getMarketplaceListing(listingId: string) {
    return this.listings.get(listingId) ?? null;
  }

  async createDeal(input: {
    creatorUserId: string;
    brandId: string;
    marketplaceListingId?: string | null;
    title: string;
    valueCents: number;
    stage: CrmDealRecord['stage'];
    expectedCloseDate?: string | null;
    notes?: string;
  }) {
    const now = new Date().toISOString();
    const deal: CrmDealRecord & { marketplaceListingId?: string } = {
      id: `deal-${this.deals.length + 1}`,
      brandId: input.brandId,
      title: input.title,
      valueCents: input.valueCents,
      stage: input.stage,
      expectedCloseDate: input.expectedCloseDate ?? '',
      notes: input.notes ?? '',
      createdAt: now,
      updatedAt: now,
      ...(input.marketplaceListingId
        ? { marketplaceListingId: input.marketplaceListingId }
        : {}),
    };
    this.deals.push(deal);
    return deal;
  }

  async getBrand(_creatorUserId: string, brandId: string) {
    return this.brands.find((brand) => brand.id === brandId) ?? null;
  }

  async getJob(_creatorUserId: string, jobId: string) {
    return this.jobs.find((job) => job.id === jobId) ?? null;
  }

  async getPayment(_creatorUserId: string, paymentId: string) {
    return this.payments.find((payment) => payment.id === paymentId) ?? null;
  }

  async findDealForBrand(_creatorUserId: string, brandId: string) {
    return this.deals.find((deal) => deal.brandId === brandId) ?? null;
  }

  async createJob(input: {
    creatorUserId: string;
    brandId: string;
    dealId: string;
    title: string;
    amountCents: number;
    deadline?: string | null;
    paymentStatus?: CrmJobRecord['paymentStatus'];
    notes?: string;
  }) {
    const now = new Date().toISOString();
    const job: CrmJobRecord = {
      id: `job-${this.jobs.length + 1}`,
      brandId: input.brandId,
      dealId: input.dealId,
      title: input.title,
      deliverables: '',
      deadline: input.deadline ?? '',
      status: 'active',
      paymentStatus: input.paymentStatus ?? 'unpaid',
      amountCents: input.amountCents,
      notes: input.notes ?? '',
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.push(job);
    return job;
  }

  async updateJobPaymentStatus(
    _creatorUserId: string,
    jobId: string,
    paymentStatus: CrmJobRecord['paymentStatus'],
  ) {
    const job = this.jobs.find((item) => item.id === jobId);
    if (!job) return null;
    job.paymentStatus = paymentStatus;
    job.updatedAt = new Date().toISOString();
    return job;
  }

  async nextInvoiceNumber(_creatorUserId: string) {
    const seq = this.payments.length + 1;
    return `INV-TEST-${String(seq).padStart(4, '0')}`;
  }

  async createPayment(input: {
    creatorUserId: string;
    brandId: string;
    jobId: string;
    amountCents: number;
    status: CrmPaymentRecord['status'];
    dueDate: string;
    invoiceNumber: string;
    description: string;
    sentAt?: string | null;
    paidAt?: string | null;
  }) {
    const now = new Date().toISOString();
    const payment: CrmPaymentRecord = {
      id: `pay-${this.payments.length + 1}`,
      brandId: input.brandId,
      jobId: input.jobId,
      amountCents: input.amountCents,
      status: input.status,
      dueDate: input.dueDate,
      invoiceNumber: input.invoiceNumber,
      description: input.description,
      ...(input.sentAt ? { sentAt: input.sentAt } : {}),
      ...(input.paidAt ? { paidAt: input.paidAt } : {}),
      createdAt: now,
      updatedAt: now,
    };
    this.payments.unshift(payment);
    return payment;
  }

  async updatePayment(
    _creatorUserId: string,
    paymentId: string,
    patch: {
      status?: CrmPaymentRecord['status'];
      amountCents?: number;
      dueDate?: string;
      description?: string;
      sentAt?: string | null;
      paidAt?: string | null;
    },
  ) {
    const payment = this.payments.find((item) => item.id === paymentId);
    if (!payment) return null;
    if (patch.status !== undefined) payment.status = patch.status;
    if (patch.amountCents !== undefined) payment.amountCents = patch.amountCents;
    if (patch.dueDate !== undefined) payment.dueDate = patch.dueDate;
    if (patch.description !== undefined) payment.description = patch.description;
    if (patch.sentAt !== undefined) {
      if (patch.sentAt) payment.sentAt = patch.sentAt;
      else delete payment.sentAt;
    }
    if (patch.paidAt !== undefined) {
      if (patch.paidAt) payment.paidAt = patch.paidAt;
      else delete payment.paidAt;
    }
    payment.updatedAt = new Date().toISOString();
    return payment;
  }

  async updateBrandNotes(
    _creatorUserId: string,
    brandId: string,
    notes: string,
  ) {
    const brand = this.brands.find((item) => item.id === brandId);
    if (!brand) return null;
    brand.notes = notes;
    brand.updatedAt = new Date().toISOString();
    return brand;
  }

  async updateJobNotes(_creatorUserId: string, jobId: string, notes: string) {
    const job = this.jobs.find((item) => item.id === jobId);
    if (!job) return null;
    job.notes = notes;
    job.updatedAt = new Date().toISOString();
    return job;
  }

  async createTask(input: {
    creatorUserId: string;
    brandId?: string | null;
    jobId?: string | null;
    title: string;
    dueDate?: string | null;
    status?: CrmTaskRecord['status'];
  }) {
    const task: CrmTaskRecord = {
      id: `task-${this.tasks.length + 1}`,
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.jobId ? { jobId: input.jobId } : {}),
      title: input.title,
      dueDate: input.dueDate ?? '',
      status: input.status ?? 'pending',
      createdAt: new Date().toISOString(),
    };
    this.tasks.unshift(task);
    return task;
  }

  async createCalendarEvent(input: {
    creatorUserId: string;
    brandId?: string | null;
    jobId?: string | null;
    title: string;
    type: import('./creator-crm.repository').CrmCalendarEventRecord['type'];
    date: string;
    notes?: string;
  }) {
    return {
      id: 'cal-1',
      ...(input.brandId ? { brandId: input.brandId } : {}),
      ...(input.jobId ? { jobId: input.jobId } : {}),
      title: input.title,
      type: input.type,
      date: input.date,
      notes: input.notes ?? '',
    };
  }

  async createContract(input: {
    creatorUserId: string;
    brandId: string;
    jobId?: string | null;
    title: string;
    status?: import('./creator-crm.repository').CrmContractRecord['status'];
    fileName?: string | null;
    storageProvider?: 'local' | 'bunny' | null;
    storageKey?: string | null;
    contentType?: string | null;
    sizeBytes?: number | null;
    expiresAt?: string | null;
  }) {
    const now = new Date().toISOString();
    return {
      id: 'contract-1',
      brandId: input.brandId,
      ...(input.jobId ? { jobId: input.jobId } : {}),
      title: input.title,
      status: input.status ?? 'draft',
      ...(input.fileName ? { fileName: input.fileName } : {}),
      ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
      createdAt: now,
      updatedAt: now,
    };
  }

  async getContract() {
    return null;
  }
}

class FakeFileStorage {
  async upload(
    _file: { buffer: Buffer; originalname: string; mimetype: string; size: number },
    key: string,
  ) {
    return { provider: 'local' as const, key };
  }
  async read() {
    return Buffer.from('');
  }
  async delete() {}
}

describe('CreatorCrmService', () => {
  let repository: FakeCreatorCrmRepository;
  let service: CreatorCrmService;

  beforeEach(() => {
    repository = new FakeCreatorCrmRepository();
    repository.deals.push({
      id: 'deal-1',
      brandId: 'brand-1',
      title: 'Test deal',
      valueCents: 1000,
      stage: 'lead',
      expectedCloseDate: '2026-08-01',
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    repository.brands.push({
      id: 'brand-1',
      name: 'Acme',
      contactName: 'Acme',
      email: 'a@acme.com',
      phone: '',
      website: '',
      relationshipStage: 'prospect',
      tags: [],
      notes: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    repository.tasks.push({
      id: 'task-1',
      title: 'Follow up',
      dueDate: '2026-07-20',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
    repository.listings.set('listing-1', {
      id: 'listing-1',
      name: 'Summer UGC',
      brandName: 'Nike',
      ownerUserId: 'brand-user',
      type: 'tiktok',
      applicationDeadline: '2026-08-01',
      brief: 'Create TikToks',
      payment: { structure: 'flat_rate', flatAmountCents: 50000 },
    });
    service = new CreatorCrmService(
      repository,
      new FakeFileStorage() as never,
    );
  });

  it('moves a deal stage and records activity', async () => {
    const data = await service.moveDealStage('creator-1', 'deal-1', 'pitched');
    expect(data.deals[0].stage).toBe('pitched');
    expect(data.activities[0].type).toBe('deal_moved');
  });

  it('toggles task status', async () => {
    const data = await service.updateTaskStatus('creator-1', 'task-1', 'done');
    expect(data.tasks[0].status).toBe('done');
  });

  it('creates a prospect brand for invites', async () => {
    const brand = await service.ensureProspectBrand('creator-1', {
      name: 'New Brand',
      email: 'hello@newbrand.com',
    });
    expect(brand.email).toBe('hello@newbrand.com');
    expect(brand.tags).toContain('Invited via Thesi');
  });

  it('adds a marketplace listing to the pipeline once', async () => {
    await service.addListingToPipeline('creator-1', 'listing-1');
    await service.addListingToPipeline('creator-1', 'listing-1');
    const data = await service.getCrm('creator-1');
    expect(data.deals.filter((d) => d.title === 'Summer UGC')).toHaveLength(1);
    expect(data.brands.some((b) => b.name === 'Nike')).toBe(true);
  });

  it('rejects non-creators', async () => {
    repository.user = { id: 'brand-1', role: 'brand' };
    await expect(service.getCrm('brand-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('fails when deal is missing', async () => {
    await expect(
      service.moveDealStage('creator-1', 'missing', 'won'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates an invoice and auto-creates a job', async () => {
    const data = await service.createPayment('creator-1', {
      brandId: 'brand-1',
      amountCents: 75000,
      dueDate: '2026-08-01',
      description: 'TikTok package',
    });
    expect(data.payments).toHaveLength(1);
    expect(data.payments[0].invoiceNumber).toMatch(/^INV-TEST-/);
    expect(data.jobs).toHaveLength(1);
    expect(data.jobs[0].title).toBe('TikTok package');
  });

  it('marks an invoice paid and syncs job payment status', async () => {
    await service.createPayment('creator-1', {
      brandId: 'brand-1',
      amountCents: 10000,
      dueDate: '2026-08-01',
    });
    const paymentId = repository.payments[0].id;
    const data = await service.updatePayment('creator-1', paymentId, {
      status: 'paid',
    });
    expect(data.payments[0].status).toBe('paid');
    expect(data.jobs[0].paymentStatus).toBe('paid');
    expect(data.activities.some((a) => a.type === 'payment_marked_paid')).toBe(
      true,
    );
  });
});
