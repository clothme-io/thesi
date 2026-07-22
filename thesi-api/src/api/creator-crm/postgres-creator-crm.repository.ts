import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type { MarketplacePaymentJson } from 'src/dbConfig/drizzle/schema/marketplaceSchema';
import type {
  CreatorCrmAggregate,
  CreatorCrmRepository,
  CrmActivityRecord,
  CrmBrandRecord,
  CrmCalendarEventRecord,
  CrmContractRecord,
  CrmDealRecord,
  CrmJobRecord,
  CrmPaymentRecord,
  CrmTaskRecord,
  CrmUser,
  MarketplaceListingForCrm,
} from './creator-crm.repository';

function dateStr(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function iso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

@Injectable()
export class PostgresCreatorCrmRepository implements CreatorCrmRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string): Promise<CrmUser | null> {
    const [user] = await this.db
      .select({
        id: schema.thesiUser.id,
        role: schema.thesiUser.role,
        email: schema.thesiUser.email,
        fullName: schema.thesiUser.fullName,
      })
      .from(schema.thesiUser)
      .where(eq(schema.thesiUser.id, userId))
      .limit(1);
    return user ?? null;
  }

  async getAggregate(creatorUserId: string): Promise<CreatorCrmAggregate> {
    const [
      brands,
      deals,
      jobs,
      contracts,
      payments,
      calendarEvents,
      tasks,
      activities,
    ] = await Promise.all([
      this.db
        .select()
        .from(schema.crmBrand)
        .where(eq(schema.crmBrand.creatorUserId, creatorUserId))
        .orderBy(desc(schema.crmBrand.updatedAt)),
      this.db
        .select()
        .from(schema.crmDeal)
        .where(eq(schema.crmDeal.creatorUserId, creatorUserId))
        .orderBy(desc(schema.crmDeal.updatedAt)),
      this.db
        .select()
        .from(schema.crmJob)
        .where(eq(schema.crmJob.creatorUserId, creatorUserId))
        .orderBy(desc(schema.crmJob.updatedAt)),
      this.db
        .select()
        .from(schema.crmContract)
        .where(eq(schema.crmContract.creatorUserId, creatorUserId))
        .orderBy(desc(schema.crmContract.updatedAt)),
      this.db
        .select()
        .from(schema.crmPayment)
        .where(eq(schema.crmPayment.creatorUserId, creatorUserId))
        .orderBy(desc(schema.crmPayment.updatedAt)),
      this.db
        .select()
        .from(schema.crmCalendarEvent)
        .where(eq(schema.crmCalendarEvent.creatorUserId, creatorUserId))
        .orderBy(schema.crmCalendarEvent.date),
      this.db
        .select()
        .from(schema.crmTask)
        .where(eq(schema.crmTask.creatorUserId, creatorUserId))
        .orderBy(schema.crmTask.dueDate),
      this.db
        .select()
        .from(schema.crmActivity)
        .where(eq(schema.crmActivity.creatorUserId, creatorUserId))
        .orderBy(desc(schema.crmActivity.createdAt)),
    ]);

    return {
      brands: brands.map((row) => this.toBrand(row)),
      deals: deals.map((row) => this.toDeal(row)),
      jobs: jobs.map((row) => ({
        id: row.id,
        brandId: row.brandId,
        dealId: row.dealId,
        title: row.title,
        deliverables: row.deliverables,
        deadline: dateStr(row.deadline),
        status: row.status as CreatorCrmAggregate['jobs'][number]['status'],
        paymentStatus:
          row.paymentStatus as CreatorCrmAggregate['jobs'][number]['paymentStatus'],
        amountCents: row.amountCents,
        ...(row.contractId ? { contractId: row.contractId } : {}),
        notes: row.notes,
        createdAt: iso(row.createdAt),
        updatedAt: iso(row.updatedAt),
      })),
      contracts: contracts.map((row) => this.toContract(row)),
      payments: payments.map((row) => this.toPayment(row)),
      calendarEvents: calendarEvents.map((row) => ({
        id: row.id,
        ...(row.brandId ? { brandId: row.brandId } : {}),
        ...(row.jobId ? { jobId: row.jobId } : {}),
        title: row.title,
        type: row.type as CreatorCrmAggregate['calendarEvents'][number]['type'],
        date: dateStr(row.date),
        notes: row.notes,
      })),
      tasks: tasks.map((row) => this.toTask(row)),
      activities: activities.map((row) => ({
        id: row.id,
        ...(row.brandId ? { brandId: row.brandId } : {}),
        ...(row.jobId ? { jobId: row.jobId } : {}),
        ...(row.dealId ? { dealId: row.dealId } : {}),
        type: row.type as CreatorCrmAggregate['activities'][number]['type'],
        message: row.message,
        createdAt: iso(row.createdAt),
      })),
    };
  }

  async findBrandByEmail(creatorUserId: string, email: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmBrand)
      .where(
        and(
          eq(schema.crmBrand.creatorUserId, creatorUserId),
          sql`lower(${schema.crmBrand.email}) = ${email.toLowerCase()}`,
        ),
      )
      .limit(1);
    return row ? this.toBrand(row) : null;
  }

  async createBrand(input: {
    creatorUserId: string;
    name: string;
    contactName: string;
    email: string;
    phone?: string;
    website?: string;
    relationshipStage?: CrmBrandRecord['relationshipStage'];
    tags?: string[];
    notes?: string;
  }) {
    const [row] = await this.db
      .insert(schema.crmBrand)
      .values({
        creatorUserId: input.creatorUserId,
        name: input.name,
        contactName: input.contactName,
        email: input.email.trim().toLowerCase(),
        phone: input.phone ?? '',
        website: input.website ?? '',
        relationshipStage: input.relationshipStage ?? 'prospect',
        tags: input.tags ?? [],
        notes: input.notes ?? '',
      })
      .returning();
    return this.toBrand(row);
  }

  async getDeal(creatorUserId: string, dealId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmDeal)
      .where(
        and(
          eq(schema.crmDeal.creatorUserId, creatorUserId),
          eq(schema.crmDeal.id, dealId),
        ),
      )
      .limit(1);
    return row ? this.toDeal(row) : null;
  }

  async updateDealStage(
    creatorUserId: string,
    dealId: string,
    stage: CrmDealRecord['stage'],
  ) {
    const [row] = await this.db
      .update(schema.crmDeal)
      .set({ stage, updatedAt: new Date() })
      .where(
        and(
          eq(schema.crmDeal.creatorUserId, creatorUserId),
          eq(schema.crmDeal.id, dealId),
        ),
      )
      .returning();
    return row ? this.toDeal(row) : null;
  }

  async getTask(creatorUserId: string, taskId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmTask)
      .where(
        and(
          eq(schema.crmTask.creatorUserId, creatorUserId),
          eq(schema.crmTask.id, taskId),
        ),
      )
      .limit(1);
    return row ? this.toTask(row) : null;
  }

  async updateTaskStatus(
    creatorUserId: string,
    taskId: string,
    status: CrmTaskRecord['status'],
  ) {
    const [row] = await this.db
      .update(schema.crmTask)
      .set({ status })
      .where(
        and(
          eq(schema.crmTask.creatorUserId, creatorUserId),
          eq(schema.crmTask.id, taskId),
        ),
      )
      .returning();
    return row ? this.toTask(row) : null;
  }

  async createActivity(input: {
    creatorUserId: string;
    brandId?: string | null;
    jobId?: string | null;
    dealId?: string | null;
    type: CrmActivityRecord['type'];
    message: string;
  }) {
    const [row] = await this.db
      .insert(schema.crmActivity)
      .values({
        creatorUserId: input.creatorUserId,
        brandId: input.brandId ?? null,
        jobId: input.jobId ?? null,
        dealId: input.dealId ?? null,
        type: input.type,
        message: input.message,
      })
      .returning();
    return {
      id: row.id,
      ...(row.brandId ? { brandId: row.brandId } : {}),
      ...(row.jobId ? { jobId: row.jobId } : {}),
      ...(row.dealId ? { dealId: row.dealId } : {}),
      type: row.type as CrmActivityRecord['type'],
      message: row.message,
      createdAt: iso(row.createdAt),
    };
  }

  async findDealByListing(creatorUserId: string, listingId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmDeal)
      .where(
        and(
          eq(schema.crmDeal.creatorUserId, creatorUserId),
          eq(schema.crmDeal.marketplaceListingId, listingId),
        ),
      )
      .limit(1);
    return row ? this.toDeal(row) : null;
  }

  async getMarketplaceListing(
    listingId: string,
  ): Promise<MarketplaceListingForCrm | null> {
    const [row] = await this.db
      .select({
        id: schema.marketplaceListing.id,
        name: schema.marketplaceListing.name,
        brandName: schema.marketplaceListing.brandName,
        ownerUserId: schema.marketplaceListing.ownerUserId,
        type: schema.marketplaceListing.type,
        applicationDeadline: schema.marketplaceListing.applicationDeadline,
        brief: schema.marketplaceListing.brief,
        payment: schema.marketplaceListing.payment,
      })
      .from(schema.marketplaceListing)
      .where(eq(schema.marketplaceListing.id, listingId))
      .limit(1);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      brandName: row.brandName,
      ownerUserId: row.ownerUserId,
      type: row.type,
      applicationDeadline: dateStr(row.applicationDeadline),
      brief: row.brief,
      payment: row.payment as MarketplacePaymentJson,
    };
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
    const [row] = await this.db
      .insert(schema.crmDeal)
      .values({
        creatorUserId: input.creatorUserId,
        brandId: input.brandId,
        marketplaceListingId: input.marketplaceListingId ?? null,
        title: input.title,
        valueCents: input.valueCents,
        stage: input.stage,
        expectedCloseDate: input.expectedCloseDate || null,
        notes: input.notes ?? '',
      })
      .returning();
    return this.toDeal(row);
  }

  async getBrand(creatorUserId: string, brandId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmBrand)
      .where(
        and(
          eq(schema.crmBrand.creatorUserId, creatorUserId),
          eq(schema.crmBrand.id, brandId),
        ),
      )
      .limit(1);
    return row ? this.toBrand(row) : null;
  }

  async getJob(creatorUserId: string, jobId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmJob)
      .where(
        and(
          eq(schema.crmJob.creatorUserId, creatorUserId),
          eq(schema.crmJob.id, jobId),
        ),
      )
      .limit(1);
    return row ? this.toJob(row) : null;
  }

  async getPayment(creatorUserId: string, paymentId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmPayment)
      .where(
        and(
          eq(schema.crmPayment.creatorUserId, creatorUserId),
          eq(schema.crmPayment.id, paymentId),
        ),
      )
      .limit(1);
    return row ? this.toPayment(row) : null;
  }

  async findDealForBrand(creatorUserId: string, brandId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmDeal)
      .where(
        and(
          eq(schema.crmDeal.creatorUserId, creatorUserId),
          eq(schema.crmDeal.brandId, brandId),
        ),
      )
      .orderBy(desc(schema.crmDeal.updatedAt))
      .limit(1);
    return row ? this.toDeal(row) : null;
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
    const [row] = await this.db
      .insert(schema.crmJob)
      .values({
        creatorUserId: input.creatorUserId,
        brandId: input.brandId,
        dealId: input.dealId,
        title: input.title,
        amountCents: input.amountCents,
        deadline: input.deadline || null,
        paymentStatus: input.paymentStatus ?? 'unpaid',
        notes: input.notes ?? '',
      })
      .returning();
    return this.toJob(row);
  }

  async updateJobPaymentStatus(
    creatorUserId: string,
    jobId: string,
    paymentStatus: CrmJobRecord['paymentStatus'],
  ) {
    const [row] = await this.db
      .update(schema.crmJob)
      .set({ paymentStatus, updatedAt: new Date() })
      .where(
        and(
          eq(schema.crmJob.creatorUserId, creatorUserId),
          eq(schema.crmJob.id, jobId),
        ),
      )
      .returning();
    return row ? this.toJob(row) : null;
  }

  async nextInvoiceNumber(creatorUserId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.crmPayment)
      .where(eq(schema.crmPayment.creatorUserId, creatorUserId));
    const seq = (row?.count ?? 0) + 1;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `INV-${stamp}-${String(seq).padStart(4, '0')}`;
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
    const [row] = await this.db
      .insert(schema.crmPayment)
      .values({
        creatorUserId: input.creatorUserId,
        brandId: input.brandId,
        jobId: input.jobId,
        amountCents: input.amountCents,
        status: input.status,
        dueDate: input.dueDate || null,
        invoiceNumber: input.invoiceNumber,
        description: input.description,
        sentAt: input.sentAt ? new Date(input.sentAt) : null,
        paidAt: input.paidAt ? new Date(input.paidAt) : null,
      })
      .returning();
    return this.toPayment(row);
  }

  async updatePayment(
    creatorUserId: string,
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
    const updates: Partial<typeof schema.crmPayment.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.amountCents !== undefined) updates.amountCents = patch.amountCents;
    if (patch.dueDate !== undefined) updates.dueDate = patch.dueDate || null;
    if (patch.description !== undefined) updates.description = patch.description;
    if (patch.sentAt !== undefined) {
      updates.sentAt = patch.sentAt ? new Date(patch.sentAt) : null;
    }
    if (patch.paidAt !== undefined) {
      updates.paidAt = patch.paidAt ? new Date(patch.paidAt) : null;
    }

    const [row] = await this.db
      .update(schema.crmPayment)
      .set(updates)
      .where(
        and(
          eq(schema.crmPayment.creatorUserId, creatorUserId),
          eq(schema.crmPayment.id, paymentId),
        ),
      )
      .returning();
    return row ? this.toPayment(row) : null;
  }

  async updateBrandNotes(
    creatorUserId: string,
    brandId: string,
    notes: string,
  ) {
    const [row] = await this.db
      .update(schema.crmBrand)
      .set({ notes, updatedAt: new Date() })
      .where(
        and(
          eq(schema.crmBrand.creatorUserId, creatorUserId),
          eq(schema.crmBrand.id, brandId),
        ),
      )
      .returning();
    return row ? this.toBrand(row) : null;
  }

  async updateJobNotes(creatorUserId: string, jobId: string, notes: string) {
    const [row] = await this.db
      .update(schema.crmJob)
      .set({ notes, updatedAt: new Date() })
      .where(
        and(
          eq(schema.crmJob.creatorUserId, creatorUserId),
          eq(schema.crmJob.id, jobId),
        ),
      )
      .returning();
    return row ? this.toJob(row) : null;
  }

  async createTask(input: {
    creatorUserId: string;
    brandId?: string | null;
    jobId?: string | null;
    title: string;
    dueDate?: string | null;
    status?: CrmTaskRecord['status'];
  }) {
    const [row] = await this.db
      .insert(schema.crmTask)
      .values({
        creatorUserId: input.creatorUserId,
        brandId: input.brandId ?? null,
        jobId: input.jobId ?? null,
        title: input.title,
        dueDate: input.dueDate || null,
        status: input.status ?? 'pending',
      })
      .returning();
    return this.toTask(row);
  }

  async createCalendarEvent(input: {
    creatorUserId: string;
    brandId?: string | null;
    jobId?: string | null;
    title: string;
    type: CrmCalendarEventRecord['type'];
    date: string;
    notes?: string;
  }) {
    const [row] = await this.db
      .insert(schema.crmCalendarEvent)
      .values({
        creatorUserId: input.creatorUserId,
        brandId: input.brandId ?? null,
        jobId: input.jobId ?? null,
        title: input.title,
        type: input.type,
        date: input.date,
        notes: input.notes ?? '',
      })
      .returning();
    return {
      id: row.id,
      ...(row.brandId ? { brandId: row.brandId } : {}),
      ...(row.jobId ? { jobId: row.jobId } : {}),
      title: row.title,
      type: row.type as CrmCalendarEventRecord['type'],
      date: dateStr(row.date),
      notes: row.notes,
    };
  }

  async createContract(input: {
    creatorUserId: string;
    brandId: string;
    jobId?: string | null;
    title: string;
    status?: CrmContractRecord['status'];
    fileName?: string | null;
    storageProvider?: 'local' | 'bunny' | null;
    storageKey?: string | null;
    contentType?: string | null;
    sizeBytes?: number | null;
    expiresAt?: string | null;
  }) {
    const [row] = await this.db
      .insert(schema.crmContract)
      .values({
        creatorUserId: input.creatorUserId,
        brandId: input.brandId,
        jobId: input.jobId ?? null,
        title: input.title,
        status: input.status ?? 'draft',
        fileName: input.fileName ?? null,
        storageProvider: input.storageProvider ?? null,
        storageKey: input.storageKey ?? null,
        contentType: input.contentType ?? null,
        sizeBytes: input.sizeBytes ?? null,
        expiresAt: input.expiresAt || null,
      })
      .returning();
    return this.toContract(row);
  }

  async getContract(creatorUserId: string, contractId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmContract)
      .where(
        and(
          eq(schema.crmContract.creatorUserId, creatorUserId),
          eq(schema.crmContract.id, contractId),
        ),
      )
      .limit(1);
    return row ? this.toContract(row) : null;
  }

  private toContract(
    row: typeof schema.crmContract.$inferSelect,
  ): CrmContractRecord {
    return {
      id: row.id,
      brandId: row.brandId,
      ...(row.jobId ? { jobId: row.jobId } : {}),
      title: row.title,
      status: row.status as CrmContractRecord['status'],
      ...(row.fileName ? { fileName: row.fileName } : {}),
      ...(row.storageProvider
        ? { storageProvider: row.storageProvider as 'local' | 'bunny' }
        : {}),
      ...(row.storageKey ? { storageKey: row.storageKey } : {}),
      ...(row.contentType ? { contentType: row.contentType } : {}),
      ...(row.sizeBytes != null ? { sizeBytes: row.sizeBytes } : {}),
      ...(row.signedAt ? { signedAt: iso(row.signedAt) } : {}),
      ...(row.expiresAt ? { expiresAt: dateStr(row.expiresAt) } : {}),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private toJob(row: typeof schema.crmJob.$inferSelect): CrmJobRecord {
    return {
      id: row.id,
      brandId: row.brandId,
      dealId: row.dealId,
      title: row.title,
      deliverables: row.deliverables,
      deadline: dateStr(row.deadline),
      status: row.status as CrmJobRecord['status'],
      paymentStatus: row.paymentStatus as CrmJobRecord['paymentStatus'],
      amountCents: row.amountCents,
      ...(row.contractId ? { contractId: row.contractId } : {}),
      notes: row.notes,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private toPayment(row: typeof schema.crmPayment.$inferSelect): CrmPaymentRecord {
    return {
      id: row.id,
      brandId: row.brandId,
      jobId: row.jobId,
      amountCents: row.amountCents,
      status: row.status as CrmPaymentRecord['status'],
      dueDate: dateStr(row.dueDate),
      ...(row.paidAt ? { paidAt: iso(row.paidAt) } : {}),
      ...(row.invoiceNumber ? { invoiceNumber: row.invoiceNumber } : {}),
      description: row.description ?? '',
      ...(row.sentAt ? { sentAt: iso(row.sentAt) } : {}),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private toBrand(row: typeof schema.crmBrand.$inferSelect): CrmBrandRecord {
    return {
      id: row.id,
      name: row.name,
      contactName: row.contactName,
      email: row.email,
      phone: row.phone,
      website: row.website,
      relationshipStage:
        row.relationshipStage as CrmBrandRecord['relationshipStage'],
      tags: Array.isArray(row.tags) ? row.tags : [],
      notes: row.notes,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private toDeal(row: typeof schema.crmDeal.$inferSelect): CrmDealRecord {
    return {
      id: row.id,
      brandId: row.brandId,
      title: row.title,
      valueCents: row.valueCents,
      stage: row.stage as CrmDealRecord['stage'],
      expectedCloseDate: dateStr(row.expectedCloseDate),
      notes: row.notes,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private toTask(row: typeof schema.crmTask.$inferSelect): CrmTaskRecord {
    return {
      id: row.id,
      ...(row.brandId ? { brandId: row.brandId } : {}),
      ...(row.jobId ? { jobId: row.jobId } : {}),
      title: row.title,
      dueDate: dateStr(row.dueDate),
      status: row.status as CrmTaskRecord['status'],
      createdAt: iso(row.createdAt),
    };
  }
}
