import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { buildInvoicePdf } from 'src/api/billing/invoice-pdf';
import {
  FILE_STORAGE,
  type FileStoragePort,
  type UploadableFile,
} from 'src/shared/storage/file-storage.port';
import {
  CREATOR_CRM_REPOSITORY,
  type CreatorCrmAggregate,
  type CreatorCrmRepository,
  type CrmBrandRecord,
  type CrmCalendarEventRecord,
  type CrmContractRecord,
  type CrmCustomFieldType,
  type CrmDealRecord,
  type CrmFieldTargetType,
  type CrmPaymentRecord,
  type CrmTaskRecord,
  type CrmWorkflowActionType,
  type CrmWorkflowTriggerType,
} from './creator-crm.repository';

const DEAL_STAGE_LABELS: Record<CrmDealRecord['stage'], string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  pitched: 'Pitched',
  negotiating: 'Negotiating',
  contract_sent: 'Contract Sent',
  won: 'Won',
  lost: 'Lost',
};

const MAX_CONTRACT_BYTES = 25 * 1024 * 1024;

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 180) || 'contract';
}

function toApiName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  return slug || 'field';
}

function isAllowedContractMime(mime: string): boolean {
  const normalized = mime.toLowerCase();
  return (
    normalized.startsWith('image/') ||
    normalized === 'application/pdf' ||
    normalized.includes('document') ||
    normalized.includes('msword') ||
    normalized.includes('officedocument') ||
    normalized === 'application/zip' ||
    normalized === 'text/plain'
  );
}

function listingValueCents(payment: {
  structure: string;
  flatAmountCents?: number;
  milestones?: Array<{ amountCents: number }>;
  royaltyMinimumCents?: number;
  hybridFlatCents?: number;
}): number {
  switch (payment.structure) {
    case 'flat_rate':
      return payment.flatAmountCents ?? 0;
    case 'milestone':
      return payment.milestones?.reduce((sum, m) => sum + m.amountCents, 0) ?? 0;
    case 'royalty':
      return payment.royaltyMinimumCents ?? 0;
    case 'hybrid':
      return payment.hybridFlatCents ?? 0;
    default:
      return 0;
  }
}

@Injectable()
export class CreatorCrmService {
  constructor(
    @Inject(CREATOR_CRM_REPOSITORY)
    private readonly crm: CreatorCrmRepository,
    @Inject(FILE_STORAGE)
    private readonly storage: FileStoragePort,
  ) {}

  async getCrm(userId: string): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    return this.crm.getAggregate(userId);
  }

  async createDeal(
    userId: string,
    input: {
      brandId: string;
      title: string;
      valueCents?: number;
      stage?: CrmDealRecord['stage'];
      expectedCloseDate?: string;
      primaryContactId?: string;
      notes?: string;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const brand = await this.crm.getBrand(userId, input.brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    const title = input.title.trim();
    if (!title) {
      throw new BadRequestException('title is required');
    }
    let primaryContactId = input.primaryContactId?.trim() || null;
    if (primaryContactId) {
      const person = await this.crm.getBrandPerson(userId, primaryContactId);
      if (!person || person.brandId !== brand.id) {
        throw new BadRequestException(
          'Primary contact must belong to this brand',
        );
      }
    }
    const stage = input.stage ?? 'lead';
    const deal = await this.crm.createDeal({
      creatorUserId: userId,
      brandId: brand.id,
      primaryContactId,
      title,
      valueCents: input.valueCents ?? 0,
      stage,
      expectedCloseDate: input.expectedCloseDate || null,
      notes: input.notes?.trim() || '',
    });
    await this.crm.createActivity({
      creatorUserId: userId,
      brandId: brand.id,
      dealId: deal.id,
      type: 'deal_moved',
      message: `Deal created in ${DEAL_STAGE_LABELS[stage]}: ${deal.title}`,
    });
    await this.runWorkflows(userId, 'deal_created', {
      brandId: brand.id,
      dealId: deal.id,
      dealStage: deal.stage,
    });
    return this.crm.getAggregate(userId);
  }

  async updateDeal(
    userId: string,
    dealId: string,
    patch: {
      title?: string;
      valueCents?: number;
      expectedCloseDate?: string;
      primaryContactId?: string | null;
      notes?: string;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const deal = await this.crm.getDeal(userId, dealId);
    if (!deal) {
      throw new NotFoundException('Deal not found');
    }
    if (patch.primaryContactId) {
      const person = await this.crm.getBrandPerson(
        userId,
        patch.primaryContactId,
      );
      if (!person || person.brandId !== deal.brandId) {
        throw new BadRequestException(
          'Primary contact must belong to this brand',
        );
      }
    }
    const updated = await this.crm.updateDeal(userId, dealId, {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.valueCents !== undefined
        ? { valueCents: patch.valueCents }
        : {}),
      ...(patch.expectedCloseDate !== undefined
        ? { expectedCloseDate: patch.expectedCloseDate || null }
        : {}),
      ...(patch.primaryContactId !== undefined
        ? { primaryContactId: patch.primaryContactId }
        : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes.trim() } : {}),
    });
    if (!updated) {
      throw new NotFoundException('Deal not found');
    }
    await this.crm.createActivity({
      creatorUserId: userId,
      brandId: updated.brandId,
      dealId: updated.id,
      type: 'status_changed',
      message: `Deal updated: ${updated.title}`,
    });
    return this.crm.getAggregate(userId);
  }

  async moveDealStage(
    userId: string,
    dealId: string,
    stage: CrmDealRecord['stage'],
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const deal = await this.crm.getDeal(userId, dealId);
    if (!deal) {
      throw new NotFoundException('Deal not found');
    }
    if (deal.stage !== stage) {
      await this.crm.updateDealStage(userId, dealId, stage);
      await this.crm.createActivity({
        creatorUserId: userId,
        brandId: deal.brandId,
        dealId: deal.id,
        type: 'deal_moved',
        message: `Deal moved to ${DEAL_STAGE_LABELS[stage]}`,
      });

      // Product rule: won deals become active jobs (idempotent).
      if (stage === 'won') {
        const existingJob = await this.crm.findJobByDealId(userId, deal.id);
        if (!existingJob) {
          const job = await this.crm.createJob({
            creatorUserId: userId,
            brandId: deal.brandId,
            dealId: deal.id,
            title: deal.title,
            amountCents: deal.valueCents,
            deadline: deal.expectedCloseDate || null,
            paymentStatus: 'unpaid',
            notes: deal.notes || 'Created when deal was won',
          });
          await this.crm.createActivity({
            creatorUserId: userId,
            brandId: deal.brandId,
            dealId: deal.id,
            jobId: job.id,
            type: 'job_created',
            message: `Job created from won deal: ${job.title}`,
          });
        }
      }

      await this.runWorkflows(userId, 'deal_stage_changed', {
        brandId: deal.brandId,
        dealId: deal.id,
        dealStage: stage,
        fromStage: deal.stage,
      });
    }
    return this.crm.getAggregate(userId);
  }

  async createBrand(
    userId: string,
    input: {
      name: string;
      contactName?: string;
      email?: string;
      phone?: string;
      website?: string;
      relationshipStage?: CrmBrandRecord['relationshipStage'];
      tags?: string[];
      notes?: string;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const email = input.email?.trim().toLowerCase() || '';
    if (email) {
      const existing = await this.crm.findBrandByEmail(userId, email);
      if (existing) {
        throw new BadRequestException('A brand with this email already exists');
      }
    }
    await this.crm.createBrand({
      creatorUserId: userId,
      name,
      contactName: input.contactName?.trim() || name,
      email,
      phone: input.phone?.trim() || '',
      website: input.website?.trim() || '',
      relationshipStage: input.relationshipStage ?? 'prospect',
      tags: input.tags ?? [],
      notes: input.notes?.trim() || '',
    });
    return this.crm.getAggregate(userId);
  }

  async importCsv(
    userId: string,
    input: {
      brands?: Array<{
        name: string;
        contactName?: string;
        email?: string;
        phone?: string;
        website?: string;
        relationshipStage?: CrmBrandRecord['relationshipStage'];
        tags?: string;
        notes?: string;
      }>;
      deals?: Array<{
        brandName: string;
        title: string;
        valueCents?: number;
        stage?: CrmDealRecord['stage'];
        expectedCloseDate?: string;
        notes?: string;
      }>;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const brands = input.brands ?? [];
    const deals = input.deals ?? [];
    if (brands.length + deals.length === 0) {
      throw new BadRequestException('Nothing to import');
    }
    if (brands.length > 100 || deals.length > 200) {
      throw new BadRequestException('Import too large');
    }

    for (const row of brands) {
      const name = row.name?.trim();
      if (!name) continue;
      const email = row.email?.trim().toLowerCase() || '';
      if (email) {
        const existing = await this.crm.findBrandByEmail(userId, email);
        if (existing) continue;
      }
      const tags = row.tags
        ? row.tags
            .split(/[|,]/)
            .map((tag) => tag.trim())
            .filter(Boolean)
        : [];
      await this.crm.createBrand({
        creatorUserId: userId,
        name,
        contactName: row.contactName?.trim() || name,
        email,
        phone: row.phone?.trim() || '',
        website: row.website?.trim() || '',
        relationshipStage: row.relationshipStage ?? 'prospect',
        tags,
        notes: row.notes?.trim() || 'Imported from CSV',
      });
    }

    const aggregate = await this.crm.getAggregate(userId);
    const brandByName = new Map(
      aggregate.brands.map((brand) => [brand.name.toLowerCase(), brand]),
    );

    for (const row of deals) {
      const title = row.title?.trim();
      const brandName = row.brandName?.trim();
      if (!title || !brandName) continue;
      let brand = brandByName.get(brandName.toLowerCase());
      if (!brand) {
        brand = await this.crm.createBrand({
          creatorUserId: userId,
          name: brandName,
          contactName: brandName,
          email: '',
          relationshipStage: 'prospect',
          tags: ['Imported'],
          notes: 'Created from deal CSV import',
        });
        brandByName.set(brandName.toLowerCase(), brand);
      }
      await this.crm.createDeal({
        creatorUserId: userId,
        brandId: brand.id,
        title,
        valueCents: row.valueCents ?? 0,
        stage: row.stage ?? 'lead',
        expectedCloseDate: row.expectedCloseDate || null,
        notes: row.notes?.trim() || 'Imported from CSV',
      });
    }

    return this.crm.getAggregate(userId);
  }

  async createTask(
    userId: string,
    input: {
      title: string;
      body?: string;
      brandId?: string;
      jobId?: string;
      dueDate?: string;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const title = input.title.trim();
    if (!title) {
      throw new BadRequestException('title is required');
    }

    let brandId = input.brandId?.trim() || null;
    let jobId = input.jobId?.trim() || null;

    if (jobId) {
      const job = await this.crm.getJob(userId, jobId);
      if (!job) {
        throw new NotFoundException('Job not found');
      }
      if (brandId && brandId !== job.brandId) {
        throw new BadRequestException('Job does not belong to this brand');
      }
      brandId = brandId || job.brandId;
    } else if (brandId) {
      const brand = await this.crm.getBrand(userId, brandId);
      if (!brand) {
        throw new NotFoundException('Brand not found');
      }
    }

    await this.crm.createTask({
      creatorUserId: userId,
      brandId,
      jobId,
      title,
      body: input.body?.trim() || '',
      dueDate: input.dueDate || null,
      status: 'pending',
    });
    await this.runWorkflows(userId, 'task_created', {
      brandId: brandId || undefined,
      jobId: jobId || undefined,
    });
    return this.crm.getAggregate(userId);
  }

  async createBrandPerson(
    userId: string,
    brandId: string,
    input: {
      name: string;
      email?: string;
      phone?: string;
      roleTitle?: string;
      isPrimary?: boolean;
      notes?: string;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const brand = await this.crm.getBrand(userId, brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    const name = input.name.trim();
    if (!name) {
      throw new BadRequestException('name is required');
    }
    const aggregate = await this.crm.getAggregate(userId);
    const peopleCount = aggregate.people.filter(
      (person) => person.brandId === brandId,
    ).length;
    if (peopleCount >= 20) {
      throw new BadRequestException('Maximum of 20 people per brand');
    }
    const isPrimary = Boolean(input.isPrimary);
    if (isPrimary) {
      await this.crm.clearPrimaryPeopleForBrand(userId, brandId);
    }
    const person = await this.crm.createBrandPerson({
      creatorUserId: userId,
      brandId,
      name,
      email: input.email?.trim() || '',
      phone: input.phone?.trim() || '',
      roleTitle: input.roleTitle?.trim() || '',
      isPrimary,
      notes: input.notes?.trim() || '',
    });
    await this.crm.createActivity({
      creatorUserId: userId,
      brandId,
      type: 'note_added',
      message: `Person added: ${person.name}`,
    });
    return this.crm.getAggregate(userId);
  }

  async updateBrandPerson(
    userId: string,
    personId: string,
    patch: {
      name?: string;
      email?: string;
      phone?: string;
      roleTitle?: string;
      isPrimary?: boolean;
      notes?: string;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const existing = await this.crm.getBrandPerson(userId, personId);
    if (!existing) {
      throw new NotFoundException('Person not found');
    }
    if (patch.isPrimary) {
      await this.crm.clearPrimaryPeopleForBrand(
        userId,
        existing.brandId,
        personId,
      );
    }
    const person = await this.crm.updateBrandPerson(userId, personId, {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.email !== undefined ? { email: patch.email.trim() } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone.trim() } : {}),
      ...(patch.roleTitle !== undefined
        ? { roleTitle: patch.roleTitle.trim() }
        : {}),
      ...(patch.isPrimary !== undefined ? { isPrimary: patch.isPrimary } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes.trim() } : {}),
    });
    if (!person) {
      throw new NotFoundException('Person not found');
    }
    return this.crm.getAggregate(userId);
  }

  async deleteBrandPerson(
    userId: string,
    personId: string,
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const existing = await this.crm.getBrandPerson(userId, personId);
    if (!existing) {
      throw new NotFoundException('Person not found');
    }
    await this.crm.deleteBrandPerson(userId, personId);
    await this.crm.createActivity({
      creatorUserId: userId,
      brandId: existing.brandId,
      type: 'note_added',
      message: `Person removed: ${existing.name}`,
    });
    return this.crm.getAggregate(userId);
  }

  async updateTaskStatus(
    userId: string,
    taskId: string,
    status: CrmTaskRecord['status'],
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const task = await this.crm.updateTaskStatus(userId, taskId, status);
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return this.crm.getAggregate(userId);
  }

  async updateBrandNotes(
    userId: string,
    brandId: string,
    notes: string,
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const brand = await this.crm.updateBrandNotes(
      userId,
      brandId,
      notes.trim(),
    );
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    await this.crm.createActivity({
      creatorUserId: userId,
      brandId: brand.id,
      type: 'note_added',
      message: notes.trim()
        ? 'Brand notes updated'
        : 'Brand notes cleared',
    });
    return this.crm.getAggregate(userId);
  }

  async updateJobNotes(
    userId: string,
    jobId: string,
    notes: string,
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const job = await this.crm.updateJobNotes(userId, jobId, notes.trim());
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    await this.crm.createActivity({
      creatorUserId: userId,
      brandId: job.brandId,
      jobId: job.id,
      type: 'note_added',
      message: notes.trim() ? 'Job notes updated' : 'Job notes cleared',
    });
    return this.crm.getAggregate(userId);
  }

  async createCalendarEvent(
    userId: string,
    input: {
      title: string;
      type: CrmCalendarEventRecord['type'];
      date: string;
      brandId?: string;
      jobId?: string;
      notes?: string;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const title = input.title.trim();
    if (!title) {
      throw new BadRequestException('title is required');
    }

    let brandId = input.brandId?.trim() || null;
    let jobId = input.jobId?.trim() || null;

    if (jobId) {
      const job = await this.crm.getJob(userId, jobId);
      if (!job) {
        throw new NotFoundException('Job not found');
      }
      if (brandId && brandId !== job.brandId) {
        throw new BadRequestException('Job does not belong to this brand');
      }
      brandId = brandId || job.brandId;
    } else if (brandId) {
      const brand = await this.crm.getBrand(userId, brandId);
      if (!brand) {
        throw new NotFoundException('Brand not found');
      }
    }

    await this.crm.createCalendarEvent({
      creatorUserId: userId,
      brandId,
      jobId,
      title,
      type: input.type,
      date: input.date,
      notes: input.notes?.trim() || '',
    });
    return this.crm.getAggregate(userId);
  }

  async createContract(
    userId: string,
    input: {
      brandId: string;
      title: string;
      jobId?: string;
      status?: CrmContractRecord['status'];
      expiresAt?: string;
    },
    file?: UploadableFile,
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const brand = await this.crm.getBrand(userId, input.brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    const title = input.title.trim();
    if (!title) {
      throw new BadRequestException('title is required');
    }

    let jobId = input.jobId?.trim() || null;
    if (jobId) {
      const job = await this.crm.getJob(userId, jobId);
      if (!job) {
        throw new NotFoundException('Job not found');
      }
      if (job.brandId !== brand.id) {
        throw new BadRequestException('Job does not belong to this brand');
      }
    }

    let fileName: string | null = null;
    let storageProvider: 'local' | 'bunny' | null = null;
    let storageKey: string | null = null;
    let contentType: string | null = null;
    let sizeBytes: number | null = null;

    if (file?.buffer?.length) {
      if (file.size > MAX_CONTRACT_BYTES) {
        throw new BadRequestException('File must be 25MB or smaller');
      }
      if (!isAllowedContractMime(file.mimetype || '')) {
        throw new BadRequestException(
          'Unsupported file type. Use images, PDF, ZIP, or common documents.',
        );
      }
      const safeName = sanitizeFileName(file.originalname);
      const key = `crm-contracts/${userId}/${randomUUID()}-${safeName}`;
      const stored = await this.storage.upload(file, key);
      fileName = safeName;
      storageProvider = stored.provider;
      storageKey = stored.key;
      contentType = file.mimetype || 'application/octet-stream';
      sizeBytes = file.size;
    }

    const contract = await this.crm.createContract({
      creatorUserId: userId,
      brandId: brand.id,
      jobId,
      title,
      status: input.status ?? 'draft',
      fileName,
      storageProvider,
      storageKey,
      contentType,
      sizeBytes,
      expiresAt: input.expiresAt || null,
    });

    await this.crm.createActivity({
      creatorUserId: userId,
      brandId: brand.id,
      jobId,
      type: 'contract_uploaded',
      message: fileName
        ? `Contract uploaded: ${contract.title} (${fileName})`
        : `Contract created: ${contract.title}`,
    });

    return this.crm.getAggregate(userId);
  }

  async ensureProspectBrand(
    userId: string,
    input: {
      name: string;
      email: string;
      contactName?: string;
      tags?: string[];
      notes?: string;
    },
  ): Promise<CrmBrandRecord> {
    await this.requireCreator(userId);
    const email = input.email.trim().toLowerCase();
    if (email) {
      const existing = await this.crm.findBrandByEmail(userId, email);
      if (existing) return existing;
    }
    return this.crm.createBrand({
      creatorUserId: userId,
      name: input.name.trim(),
      contactName: input.contactName?.trim() || input.name.trim(),
      email,
      relationshipStage: 'prospect',
      tags: input.tags ?? ['Invited via Thesi'],
      notes:
        input.notes ??
        'Invited to join Thesi as a brand partner.',
    });
  }

  async createPayment(
    userId: string,
    input: {
      brandId: string;
      jobId?: string;
      amountCents: number;
      dueDate: string;
      description?: string;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const brand = await this.crm.getBrand(userId, input.brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }

    let jobId = input.jobId?.trim();
    if (jobId) {
      const job = await this.crm.getJob(userId, jobId);
      if (!job) {
        throw new NotFoundException('Job not found');
      }
      if (job.brandId !== brand.id) {
        throw new BadRequestException('Job does not belong to this brand');
      }
    } else {
      let deal = await this.crm.findDealForBrand(userId, brand.id);
      if (!deal) {
        deal = await this.crm.createDeal({
          creatorUserId: userId,
          brandId: brand.id,
          title: `${brand.name} engagement`,
          valueCents: input.amountCents,
          stage: 'won',
          notes: 'Created with invoice',
        });
      }
      const description = input.description?.trim() || 'Client invoice';
      const job = await this.crm.createJob({
        creatorUserId: userId,
        brandId: brand.id,
        dealId: deal.id,
        title: description.slice(0, 160),
        amountCents: input.amountCents,
        deadline: input.dueDate,
        paymentStatus: 'unpaid',
        notes: 'Created with invoice',
      });
      jobId = job.id;
      await this.crm.createActivity({
        creatorUserId: userId,
        brandId: brand.id,
        jobId: job.id,
        dealId: deal.id,
        type: 'job_created',
        message: `Job created for invoice: ${job.title}`,
      });
    }

    const invoiceNumber = await this.crm.nextInvoiceNumber(userId);
    const payment = await this.crm.createPayment({
      creatorUserId: userId,
      brandId: brand.id,
      jobId,
      amountCents: input.amountCents,
      status: 'unpaid',
      dueDate: input.dueDate,
      invoiceNumber,
      description: input.description?.trim() || '',
    });

    await this.crm.updateJobPaymentStatus(userId, jobId, 'unpaid');
    await this.crm.createActivity({
      creatorUserId: userId,
      brandId: brand.id,
      jobId,
      type: 'status_changed',
      message: `Invoice ${payment.invoiceNumber} created`,
    });

    return this.crm.getAggregate(userId);
  }

  async updatePayment(
    userId: string,
    paymentId: string,
    patch: {
      status?: CrmPaymentRecord['status'];
      amountCents?: number;
      dueDate?: string;
      description?: string;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const existing = await this.crm.getPayment(userId, paymentId);
    if (!existing) {
      throw new NotFoundException('Invoice not found');
    }

    const nextStatus = patch.status ?? existing.status;
    const updates: {
      status?: CrmPaymentRecord['status'];
      amountCents?: number;
      dueDate?: string;
      description?: string;
      sentAt?: string | null;
      paidAt?: string | null;
    } = {};

    if (patch.amountCents !== undefined) updates.amountCents = patch.amountCents;
    if (patch.dueDate !== undefined) updates.dueDate = patch.dueDate;
    if (patch.description !== undefined) {
      updates.description = patch.description.trim();
    }
    if (patch.status !== undefined) {
      updates.status = patch.status;
      if (patch.status === 'invoice_sent' && !existing.sentAt) {
        updates.sentAt = new Date().toISOString();
      }
      if (patch.status === 'paid') {
        updates.paidAt = existing.paidAt ?? new Date().toISOString();
      }
      if (patch.status !== 'paid') {
        updates.paidAt = null;
      }
    }

    const payment = await this.crm.updatePayment(userId, paymentId, updates);
    if (!payment) {
      throw new NotFoundException('Invoice not found');
    }

    await this.crm.updateJobPaymentStatus(userId, payment.jobId, nextStatus);

    if (patch.status === 'paid') {
      await this.crm.createActivity({
        creatorUserId: userId,
        brandId: payment.brandId,
        jobId: payment.jobId,
        type: 'payment_marked_paid',
        message: `Invoice ${payment.invoiceNumber || payment.id} marked paid`,
      });
    } else if (patch.status) {
      await this.crm.createActivity({
        creatorUserId: userId,
        brandId: payment.brandId,
        jobId: payment.jobId,
        type: 'status_changed',
        message: `Invoice ${payment.invoiceNumber || payment.id} → ${patch.status}`,
      });
    }

    if (patch.status && patch.status !== existing.status) {
      await this.runWorkflows(userId, 'payment_status_changed', {
        brandId: payment.brandId,
        jobId: payment.jobId,
        paymentStatus: patch.status,
      });
    }

    return this.crm.getAggregate(userId);
  }

  async getPaymentPdf(
    userId: string,
    paymentId: string,
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const user = await this.requireCreator(userId);
    const payment = await this.crm.getPayment(userId, paymentId);
    if (!payment) {
      throw new NotFoundException('Invoice not found');
    }
    const brand = await this.crm.getBrand(userId, payment.brandId);
    if (!brand) {
      throw new NotFoundException('Brand not found');
    }
    const invoiceNumber =
      payment.invoiceNumber || `INV-${payment.id.slice(0, 8)}`;
    const buffer = buildInvoicePdf({
      invoiceNumber,
      description:
        payment.description ||
        `Creator invoice for ${brand.name}`,
      amountCents: payment.amountCents,
      status: payment.status,
      invoiceDate: payment.createdAt.slice(0, 10),
      companyName: brand.name,
      billingEmail: brand.email,
      addressLines: [brand.contactName, brand.website].filter(Boolean),
      fromName: user.fullName || 'Creator',
      fromEmail: user.email || '',
    });
    return { fileName: `${invoiceNumber}.pdf`, buffer };
  }

  async addListingToPipeline(
    userId: string,
    listingId: string,
  ): Promise<void> {
    await this.requireCreator(userId);
    const existingDeal = await this.crm.findDealByListing(userId, listingId);
    if (existingDeal) return;

    const listing = await this.crm.getMarketplaceListing(listingId);
    if (!listing) {
      throw new NotFoundException('Listing not found');
    }

    const aggregate = await this.crm.getAggregate(userId);
    const byName = aggregate.brands.find(
      (item) =>
        item.name.toLowerCase() === listing.brandName.toLowerCase() ||
        item.notes.includes(`listing: ${listing.name}`),
    );
    const brand =
      byName ??
      (await this.crm.createBrand({
        creatorUserId: userId,
        name: listing.brandName,
        contactName: 'Hiring team',
        email: '',
        relationshipStage: 'prospect',
        tags: ['Marketplace'],
        notes: `Added from marketplace listing: ${listing.name}`,
      }));

    const valueCents = listingValueCents(listing.payment);
    const dealNotes = [
      `Source: Marketplace — ${listing.name}`,
      `Type: ${listing.type}`,
      listing.brief.slice(0, 200),
    ].join('\n');

    const deal = await this.crm.createDeal({
      creatorUserId: userId,
      brandId: brand.id,
      marketplaceListingId: listing.id,
      title: listing.name,
      valueCents,
      stage: 'lead',
      expectedCloseDate: listing.applicationDeadline || null,
      notes: dealNotes,
    });

    await this.crm.createActivity({
      creatorUserId: userId,
      brandId: brand.id,
      dealId: deal.id,
      type: 'deal_moved',
      message: `Added marketplace listing "${listing.name}" to pipeline`,
    });
  }

  private async requireCreator(userId: string) {
    const user = await this.crm.getUser(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    if (user.role !== 'creator') {
      throw new ForbiddenException('Creator account required');
    }
    return user;
  }

  async createCustomObject(
    userId: string,
    input: { name: string; apiName?: string; description?: string },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const name = input.name.trim();
    if (!name) throw new BadRequestException('name is required');
    await this.crm.createCustomObject({
      creatorUserId: userId,
      name,
      apiName: toApiName(input.apiName?.trim() || name),
      description: input.description?.trim() || '',
    });
    return this.crm.getAggregate(userId);
  }

  async updateCustomObject(
    userId: string,
    objectId: string,
    patch: { name?: string; description?: string },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const updated = await this.crm.updateCustomObject(userId, objectId, {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description.trim() }
        : {}),
    });
    if (!updated) throw new NotFoundException('Custom object not found');
    return this.crm.getAggregate(userId);
  }

  async deleteCustomObject(
    userId: string,
    objectId: string,
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const deleted = await this.crm.deleteCustomObject(userId, objectId);
    if (!deleted) throw new NotFoundException('Custom object not found');
    return this.crm.getAggregate(userId);
  }

  async createCustomField(
    userId: string,
    input: {
      targetType: CrmFieldTargetType;
      targetObjectId?: string;
      name: string;
      apiName?: string;
      fieldType: CrmCustomFieldType;
      options?: string[];
      required?: boolean;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const name = input.name.trim();
    if (!name) throw new BadRequestException('name is required');
    if (input.targetType === 'custom_object') {
      if (!input.targetObjectId) {
        throw new BadRequestException('targetObjectId is required');
      }
      const object = await this.crm.getCustomObject(userId, input.targetObjectId);
      if (!object) throw new NotFoundException('Custom object not found');
    } else if (input.targetObjectId) {
      throw new BadRequestException(
        'targetObjectId is only valid for custom_object fields',
      );
    }
    const aggregate = await this.crm.getAggregate(userId);
    const siblings = aggregate.customFields.filter(
      (field) =>
        field.targetType === input.targetType &&
        (field.targetObjectId || null) === (input.targetObjectId || null),
    );
    await this.crm.createCustomField({
      creatorUserId: userId,
      targetType: input.targetType,
      targetObjectId: input.targetObjectId || null,
      name,
      apiName: toApiName(input.apiName?.trim() || name),
      fieldType: input.fieldType,
      options: (input.options || [])
        .map((option) => option.trim())
        .filter(Boolean),
      required: input.required ?? false,
      position: siblings.length,
    });
    return this.crm.getAggregate(userId);
  }

  async deleteCustomField(
    userId: string,
    fieldId: string,
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const deleted = await this.crm.deleteCustomField(userId, fieldId);
    if (!deleted) throw new NotFoundException('Custom field not found');
    return this.crm.getAggregate(userId);
  }

  async upsertEntityFieldValues(
    userId: string,
    input: {
      entityType: 'brand' | 'deal' | 'job';
      entityId: string;
      values: Record<string, string | number | boolean | null>;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    if (input.entityType === 'brand') {
      const brand = await this.crm.getBrand(userId, input.entityId);
      if (!brand) throw new NotFoundException('Brand not found');
    } else if (input.entityType === 'deal') {
      const deal = await this.crm.getDeal(userId, input.entityId);
      if (!deal) throw new NotFoundException('Deal not found');
    } else {
      const job = await this.crm.getJob(userId, input.entityId);
      if (!job) throw new NotFoundException('Job not found');
    }
    await this.crm.upsertEntityFieldValues({
      creatorUserId: userId,
      entityType: input.entityType,
      entityId: input.entityId,
      values: input.values,
    });
    return this.crm.getAggregate(userId);
  }

  async createCustomRecord(
    userId: string,
    input: {
      objectId: string;
      title: string;
      values?: Record<string, string | number | boolean | null>;
      brandId?: string;
      dealId?: string;
      jobId?: string;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const object = await this.crm.getCustomObject(userId, input.objectId);
    if (!object) throw new NotFoundException('Custom object not found');
    const title = input.title.trim();
    if (!title) throw new BadRequestException('title is required');
    const record = await this.crm.createCustomRecord({
      creatorUserId: userId,
      objectId: object.id,
      title,
      values: input.values ?? {},
      brandId: input.brandId || null,
      dealId: input.dealId || null,
      jobId: input.jobId || null,
    });
    await this.runWorkflows(userId, 'custom_record_created', {
      brandId: record.brandId,
      dealId: record.dealId,
      jobId: record.jobId,
      customObjectId: object.id,
      customRecordId: record.id,
    });
    return this.crm.getAggregate(userId);
  }

  async updateCustomRecord(
    userId: string,
    recordId: string,
    patch: {
      title?: string;
      values?: Record<string, string | number | boolean | null>;
      brandId?: string | null;
      dealId?: string | null;
      jobId?: string | null;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const updated = await this.crm.updateCustomRecord(userId, recordId, {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.values !== undefined ? { values: patch.values } : {}),
      ...(patch.brandId !== undefined ? { brandId: patch.brandId } : {}),
      ...(patch.dealId !== undefined ? { dealId: patch.dealId } : {}),
      ...(patch.jobId !== undefined ? { jobId: patch.jobId } : {}),
    });
    if (!updated) throw new NotFoundException('Custom record not found');
    return this.crm.getAggregate(userId);
  }

  async deleteCustomRecord(
    userId: string,
    recordId: string,
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const deleted = await this.crm.deleteCustomRecord(userId, recordId);
    if (!deleted) throw new NotFoundException('Custom record not found');
    return this.crm.getAggregate(userId);
  }

  async createWorkflow(
    userId: string,
    input: {
      name: string;
      description?: string;
      enabled?: boolean;
      triggerType: CrmWorkflowTriggerType;
      triggerConfig?: Record<string, unknown>;
      actions: Array<{
        actionType: CrmWorkflowActionType;
        actionConfig?: Record<string, unknown>;
      }>;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const name = input.name.trim();
    if (!name) throw new BadRequestException('name is required');
    if (!input.actions?.length) {
      throw new BadRequestException('At least one action is required');
    }
    await this.crm.createWorkflow({
      creatorUserId: userId,
      name,
      description: input.description?.trim() || '',
      enabled: input.enabled ?? true,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig ?? {},
      actions: input.actions.map((action, index) => ({
        actionType: action.actionType,
        actionConfig: action.actionConfig ?? {},
        position: index,
      })),
    });
    return this.crm.getAggregate(userId);
  }

  async updateWorkflow(
    userId: string,
    workflowId: string,
    patch: {
      name?: string;
      description?: string;
      enabled?: boolean;
      triggerType?: CrmWorkflowTriggerType;
      triggerConfig?: Record<string, unknown>;
      actions?: Array<{
        actionType: CrmWorkflowActionType;
        actionConfig?: Record<string, unknown>;
      }>;
    },
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const updated = await this.crm.updateWorkflow(userId, workflowId, {
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.description !== undefined
        ? { description: patch.description.trim() }
        : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.triggerType !== undefined
        ? { triggerType: patch.triggerType }
        : {}),
      ...(patch.triggerConfig !== undefined
        ? { triggerConfig: patch.triggerConfig }
        : {}),
      ...(patch.actions
        ? {
            actions: patch.actions.map((action, index) => ({
              actionType: action.actionType,
              actionConfig: action.actionConfig ?? {},
              position: index,
            })),
          }
        : {}),
    });
    if (!updated) throw new NotFoundException('Workflow not found');
    return this.crm.getAggregate(userId);
  }

  async deleteWorkflow(
    userId: string,
    workflowId: string,
  ): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
    const deleted = await this.crm.deleteWorkflow(userId, workflowId);
    if (!deleted) throw new NotFoundException('Workflow not found');
    return this.crm.getAggregate(userId);
  }

  private async runWorkflows(
    userId: string,
    triggerType: CrmWorkflowTriggerType,
    context: {
      brandId?: string;
      dealId?: string;
      jobId?: string;
      dealStage?: string;
      fromStage?: string;
      paymentStatus?: string;
      customObjectId?: string;
      customRecordId?: string;
    },
  ) {
    const workflows = await this.crm.listEnabledWorkflowsByTrigger(
      userId,
      triggerType,
    );
    for (const workflow of workflows) {
      if (!this.workflowMatches(workflow.triggerConfig, triggerType, context)) {
        continue;
      }
      for (const action of workflow.actions) {
        await this.runWorkflowAction(userId, action.actionType, action.actionConfig, context);
      }
      await this.crm.createActivity({
        creatorUserId: userId,
        brandId: context.brandId || null,
        dealId: context.dealId || null,
        jobId: context.jobId || null,
        type: 'workflow_ran',
        message: `Workflow ran: ${workflow.name}`,
      });
    }
  }

  private workflowMatches(
    config: Record<string, unknown>,
    triggerType: CrmWorkflowTriggerType,
    context: {
      dealStage?: string;
      fromStage?: string;
      paymentStatus?: string;
      customObjectId?: string;
    },
  ) {
    if (triggerType === 'deal_stage_changed') {
      const toStage = typeof config.toStage === 'string' ? config.toStage : '';
      const fromStage =
        typeof config.fromStage === 'string' ? config.fromStage : '';
      if (toStage && context.dealStage !== toStage) return false;
      if (fromStage && context.fromStage !== fromStage) return false;
    }
    if (triggerType === 'payment_status_changed') {
      const status = typeof config.status === 'string' ? config.status : '';
      if (status && context.paymentStatus !== status) return false;
    }
    if (triggerType === 'custom_record_created') {
      const objectId =
        typeof config.objectId === 'string' ? config.objectId : '';
      if (objectId && context.customObjectId !== objectId) return false;
    }
    return true;
  }

  private async runWorkflowAction(
    userId: string,
    actionType: CrmWorkflowActionType,
    config: Record<string, unknown>,
    context: {
      brandId?: string;
      dealId?: string;
      jobId?: string;
    },
  ) {
    if (actionType === 'create_task') {
      const title =
        typeof config.title === 'string' && config.title.trim()
          ? config.title.trim()
          : 'Workflow task';
      const body = typeof config.body === 'string' ? config.body : '';
      const dueInDays =
        typeof config.dueInDays === 'number' ? config.dueInDays : undefined;
      let dueDate: string | null = null;
      if (dueInDays !== undefined) {
        const date = new Date();
        date.setDate(date.getDate() + dueInDays);
        dueDate = date.toISOString().slice(0, 10);
      }
      await this.crm.createTask({
        creatorUserId: userId,
        brandId: context.brandId || null,
        jobId: context.jobId || null,
        title,
        body,
        dueDate,
        status: 'pending',
      });
      return;
    }

    if (actionType === 'create_activity') {
      const message =
        typeof config.message === 'string' && config.message.trim()
          ? config.message.trim()
          : 'Workflow note';
      await this.crm.createActivity({
        creatorUserId: userId,
        brandId: context.brandId || null,
        dealId: context.dealId || null,
        jobId: context.jobId || null,
        type: 'note_added',
        message,
      });
      return;
    }

    if (actionType === 'set_entity_field') {
      const entityType = config.entityType;
      const fieldApiName =
        typeof config.fieldApiName === 'string' ? config.fieldApiName : '';
      if (
        (entityType !== 'brand' &&
          entityType !== 'deal' &&
          entityType !== 'job') ||
        !fieldApiName
      ) {
        return;
      }
      const entityId =
        entityType === 'brand'
          ? context.brandId
          : entityType === 'deal'
            ? context.dealId
            : context.jobId;
      if (!entityId) return;
      const aggregate = await this.crm.getAggregate(userId);
      const existing =
        aggregate.entityFieldValues.find(
          (row) => row.entityType === entityType && row.entityId === entityId,
        )?.values ?? {};
      const value =
        config.value === undefined
          ? null
          : (config.value as string | number | boolean | null);
      await this.crm.upsertEntityFieldValues({
        creatorUserId: userId,
        entityType,
        entityId,
        values: { ...existing, [fieldApiName]: value },
      });
    }
  }
}
