import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { buildInvoicePdf } from 'src/api/billing/invoice-pdf';
import {
  CREATOR_CRM_REPOSITORY,
  type CreatorCrmAggregate,
  type CreatorCrmRepository,
  type CrmBrandRecord,
  type CrmDealRecord,
  type CrmPaymentRecord,
  type CrmTaskRecord,
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
  ) {}

  async getCrm(userId: string): Promise<CreatorCrmAggregate> {
    await this.requireCreator(userId);
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
    }
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
}
