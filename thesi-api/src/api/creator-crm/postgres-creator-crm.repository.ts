import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type { MarketplacePaymentJson } from 'src/dbConfig/drizzle/schema/marketplaceSchema';
import type {
  CreatorCrmAggregate,
  CreatorCrmRepository,
  CrmActivityRecord,
  CrmBrandPersonRecord,
  CrmBrandRecord,
  CrmCalendarEventRecord,
  CrmContractRecord,
  CrmCustomFieldRecord,
  CrmCustomFieldType,
  CrmCustomObjectRecord,
  CrmCustomRecordRow,
  CrmDealRecord,
  CrmEntityFieldValuesRecord,
  CrmFieldTargetType,
  CrmJobRecord,
  CrmPaymentRecord,
  CrmTaskRecord,
  CrmUser,
  CrmWorkflowActionType,
  CrmWorkflowRecord,
  CrmWorkflowTriggerType,
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
      people,
      deals,
      jobs,
      contracts,
      payments,
      calendarEvents,
      tasks,
      activities,
      customObjects,
      customFields,
      customRecords,
      entityFieldValues,
      workflows,
      workflowActions,
    ] = await Promise.all([
      this.db
        .select()
        .from(schema.crmBrand)
        .where(eq(schema.crmBrand.creatorUserId, creatorUserId))
        .orderBy(desc(schema.crmBrand.updatedAt)),
      this.db
        .select()
        .from(schema.crmBrandPerson)
        .where(eq(schema.crmBrandPerson.creatorUserId, creatorUserId))
        .orderBy(desc(schema.crmBrandPerson.updatedAt)),
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
      this.db
        .select()
        .from(schema.crmCustomObject)
        .where(eq(schema.crmCustomObject.creatorUserId, creatorUserId))
        .orderBy(desc(schema.crmCustomObject.updatedAt)),
      this.db
        .select()
        .from(schema.crmCustomField)
        .where(eq(schema.crmCustomField.creatorUserId, creatorUserId))
        .orderBy(schema.crmCustomField.position),
      this.db
        .select()
        .from(schema.crmCustomRecord)
        .where(eq(schema.crmCustomRecord.creatorUserId, creatorUserId))
        .orderBy(desc(schema.crmCustomRecord.updatedAt)),
      this.db
        .select()
        .from(schema.crmEntityFieldValues)
        .where(eq(schema.crmEntityFieldValues.creatorUserId, creatorUserId)),
      this.db
        .select()
        .from(schema.crmWorkflow)
        .where(eq(schema.crmWorkflow.creatorUserId, creatorUserId))
        .orderBy(desc(schema.crmWorkflow.updatedAt)),
      this.db
        .select()
        .from(schema.crmWorkflowAction)
        .where(eq(schema.crmWorkflowAction.creatorUserId, creatorUserId))
        .orderBy(schema.crmWorkflowAction.position),
    ]);

    return {
      brands: brands.map((row) => this.toBrand(row)),
      people: people.map((row) => this.toPerson(row)),
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
      customObjects: customObjects.map((row) => this.toCustomObject(row)),
      customFields: customFields.map((row) => this.toCustomField(row)),
      customRecords: customRecords.map((row) => this.toCustomRecord(row)),
      entityFieldValues: entityFieldValues.map((row) =>
        this.toEntityFieldValues(row),
      ),
      workflows: workflows.map((row) =>
        this.toWorkflow(
          row,
          workflowActions.filter((action) => action.workflowId === row.id),
        ),
      ),
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
    primaryContactId?: string | null;
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
        primaryContactId: input.primaryContactId ?? null,
        title: input.title,
        valueCents: input.valueCents,
        stage: input.stage,
        expectedCloseDate: input.expectedCloseDate || null,
        notes: input.notes ?? '',
      })
      .returning();
    return this.toDeal(row);
  }

  async updateDeal(
    creatorUserId: string,
    dealId: string,
    patch: {
      title?: string;
      valueCents?: number;
      expectedCloseDate?: string | null;
      notes?: string;
      primaryContactId?: string | null;
      stage?: CrmDealRecord['stage'];
    },
  ) {
    const updates: Partial<typeof schema.crmDeal.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.valueCents !== undefined) updates.valueCents = patch.valueCents;
    if (patch.expectedCloseDate !== undefined) {
      updates.expectedCloseDate = patch.expectedCloseDate || null;
    }
    if (patch.notes !== undefined) updates.notes = patch.notes;
    if (patch.primaryContactId !== undefined) {
      updates.primaryContactId = patch.primaryContactId;
    }
    if (patch.stage !== undefined) updates.stage = patch.stage;

    const [row] = await this.db
      .update(schema.crmDeal)
      .set(updates)
      .where(
        and(
          eq(schema.crmDeal.creatorUserId, creatorUserId),
          eq(schema.crmDeal.id, dealId),
        ),
      )
      .returning();
    return row ? this.toDeal(row) : null;
  }

  async getBrandPerson(creatorUserId: string, personId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmBrandPerson)
      .where(
        and(
          eq(schema.crmBrandPerson.creatorUserId, creatorUserId),
          eq(schema.crmBrandPerson.id, personId),
        ),
      )
      .limit(1);
    return row ? this.toPerson(row) : null;
  }

  async createBrandPerson(input: {
    creatorUserId: string;
    brandId: string;
    name: string;
    email?: string;
    phone?: string;
    roleTitle?: string;
    isPrimary?: boolean;
    notes?: string;
  }) {
    const [row] = await this.db
      .insert(schema.crmBrandPerson)
      .values({
        creatorUserId: input.creatorUserId,
        brandId: input.brandId,
        name: input.name,
        email: input.email ?? '',
        phone: input.phone ?? '',
        roleTitle: input.roleTitle ?? '',
        isPrimary: input.isPrimary ?? false,
        notes: input.notes ?? '',
      })
      .returning();
    return this.toPerson(row);
  }

  async updateBrandPerson(
    creatorUserId: string,
    personId: string,
    patch: {
      name?: string;
      email?: string;
      phone?: string;
      roleTitle?: string;
      isPrimary?: boolean;
      notes?: string;
    },
  ) {
    const updates: Partial<typeof schema.crmBrandPerson.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (patch.name !== undefined) updates.name = patch.name;
    if (patch.email !== undefined) updates.email = patch.email;
    if (patch.phone !== undefined) updates.phone = patch.phone;
    if (patch.roleTitle !== undefined) updates.roleTitle = patch.roleTitle;
    if (patch.isPrimary !== undefined) updates.isPrimary = patch.isPrimary;
    if (patch.notes !== undefined) updates.notes = patch.notes;

    const [row] = await this.db
      .update(schema.crmBrandPerson)
      .set(updates)
      .where(
        and(
          eq(schema.crmBrandPerson.creatorUserId, creatorUserId),
          eq(schema.crmBrandPerson.id, personId),
        ),
      )
      .returning();
    return row ? this.toPerson(row) : null;
  }

  async deleteBrandPerson(creatorUserId: string, personId: string) {
    const deleted = await this.db
      .delete(schema.crmBrandPerson)
      .where(
        and(
          eq(schema.crmBrandPerson.creatorUserId, creatorUserId),
          eq(schema.crmBrandPerson.id, personId),
        ),
      )
      .returning({ id: schema.crmBrandPerson.id });
    return deleted.length > 0;
  }

  async clearPrimaryPeopleForBrand(
    creatorUserId: string,
    brandId: string,
    exceptPersonId?: string,
  ) {
    const conditions = [
      eq(schema.crmBrandPerson.creatorUserId, creatorUserId),
      eq(schema.crmBrandPerson.brandId, brandId),
      eq(schema.crmBrandPerson.isPrimary, true),
    ];
    if (exceptPersonId) {
      conditions.push(ne(schema.crmBrandPerson.id, exceptPersonId));
    }
    await this.db
      .update(schema.crmBrandPerson)
      .set({ isPrimary: false, updatedAt: new Date() })
      .where(and(...conditions));
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

  async findJobByDealId(creatorUserId: string, dealId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmJob)
      .where(
        and(
          eq(schema.crmJob.creatorUserId, creatorUserId),
          eq(schema.crmJob.dealId, dealId),
        ),
      )
      .limit(1);
    return row ? this.toJob(row) : null;
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
    body?: string;
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
        body: input.body ?? '',
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
      ...(row.primaryContactId
        ? { primaryContactId: row.primaryContactId }
        : {}),
      title: row.title,
      valueCents: row.valueCents,
      stage: row.stage as CrmDealRecord['stage'],
      expectedCloseDate: dateStr(row.expectedCloseDate),
      notes: row.notes,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private toPerson(
    row: typeof schema.crmBrandPerson.$inferSelect,
  ): CrmBrandPersonRecord {
    return {
      id: row.id,
      brandId: row.brandId,
      name: row.name,
      email: row.email,
      phone: row.phone,
      roleTitle: row.roleTitle,
      isPrimary: Boolean(row.isPrimary),
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
      body: row.body ?? '',
      dueDate: dateStr(row.dueDate),
      status: row.status as CrmTaskRecord['status'],
      createdAt: iso(row.createdAt),
    };
  }

  private toCustomObject(
    row: typeof schema.crmCustomObject.$inferSelect,
  ): CrmCustomObjectRecord {
    return {
      id: row.id,
      name: row.name,
      apiName: row.apiName,
      description: row.description,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private toCustomField(
    row: typeof schema.crmCustomField.$inferSelect,
  ): CrmCustomFieldRecord {
    return {
      id: row.id,
      targetType: row.targetType as CrmFieldTargetType,
      ...(row.targetObjectId ? { targetObjectId: row.targetObjectId } : {}),
      name: row.name,
      apiName: row.apiName,
      fieldType: row.fieldType as CrmCustomFieldType,
      options: Array.isArray(row.options) ? row.options : [],
      required: Boolean(row.required),
      position: row.position,
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private toEntityFieldValues(
    row: typeof schema.crmEntityFieldValues.$inferSelect,
  ): CrmEntityFieldValuesRecord {
    return {
      id: row.id,
      entityType: row.entityType as CrmEntityFieldValuesRecord['entityType'],
      entityId: row.entityId,
      values:
        row.values && typeof row.values === 'object' && !Array.isArray(row.values)
          ? (row.values as Record<string, string | number | boolean | null>)
          : {},
      updatedAt: iso(row.updatedAt),
    };
  }

  private toCustomRecord(
    row: typeof schema.crmCustomRecord.$inferSelect,
  ): CrmCustomRecordRow {
    return {
      id: row.id,
      objectId: row.objectId,
      title: row.title,
      values:
        row.values && typeof row.values === 'object' && !Array.isArray(row.values)
          ? (row.values as Record<string, string | number | boolean | null>)
          : {},
      ...(row.brandId ? { brandId: row.brandId } : {}),
      ...(row.dealId ? { dealId: row.dealId } : {}),
      ...(row.jobId ? { jobId: row.jobId } : {}),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  private toWorkflow(
    row: typeof schema.crmWorkflow.$inferSelect,
    actions: Array<typeof schema.crmWorkflowAction.$inferSelect>,
  ): CrmWorkflowRecord {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      enabled: Boolean(row.enabled),
      triggerType: row.triggerType as CrmWorkflowTriggerType,
      triggerConfig:
        row.triggerConfig && typeof row.triggerConfig === 'object'
          ? (row.triggerConfig as Record<string, unknown>)
          : {},
      actions: actions
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((action) => ({
          id: action.id,
          workflowId: action.workflowId,
          position: action.position,
          actionType: action.actionType as CrmWorkflowActionType,
          actionConfig:
            action.actionConfig && typeof action.actionConfig === 'object'
              ? (action.actionConfig as Record<string, unknown>)
              : {},
          createdAt: iso(action.createdAt),
        })),
      createdAt: iso(row.createdAt),
      updatedAt: iso(row.updatedAt),
    };
  }

  async createCustomObject(input: {
    creatorUserId: string;
    name: string;
    apiName: string;
    description?: string;
  }) {
    const [row] = await this.db
      .insert(schema.crmCustomObject)
      .values({
        creatorUserId: input.creatorUserId,
        name: input.name,
        apiName: input.apiName,
        description: input.description ?? '',
      })
      .returning();
    return this.toCustomObject(row);
  }

  async updateCustomObject(
    creatorUserId: string,
    objectId: string,
    patch: { name?: string; description?: string },
  ) {
    const [row] = await this.db
      .update(schema.crmCustomObject)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.crmCustomObject.creatorUserId, creatorUserId),
          eq(schema.crmCustomObject.id, objectId),
        ),
      )
      .returning();
    return row ? this.toCustomObject(row) : null;
  }

  async deleteCustomObject(creatorUserId: string, objectId: string) {
    const deleted = await this.db
      .delete(schema.crmCustomObject)
      .where(
        and(
          eq(schema.crmCustomObject.creatorUserId, creatorUserId),
          eq(schema.crmCustomObject.id, objectId),
        ),
      )
      .returning({ id: schema.crmCustomObject.id });
    return deleted.length > 0;
  }

  async getCustomObject(creatorUserId: string, objectId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmCustomObject)
      .where(
        and(
          eq(schema.crmCustomObject.creatorUserId, creatorUserId),
          eq(schema.crmCustomObject.id, objectId),
        ),
      )
      .limit(1);
    return row ? this.toCustomObject(row) : null;
  }

  async createCustomField(input: {
    creatorUserId: string;
    targetType: CrmFieldTargetType;
    targetObjectId?: string | null;
    name: string;
    apiName: string;
    fieldType: CrmCustomFieldType;
    options?: string[];
    required?: boolean;
    position?: number;
  }) {
    const [row] = await this.db
      .insert(schema.crmCustomField)
      .values({
        creatorUserId: input.creatorUserId,
        targetType: input.targetType,
        targetObjectId: input.targetObjectId ?? null,
        name: input.name,
        apiName: input.apiName,
        fieldType: input.fieldType,
        options: input.options ?? [],
        required: input.required ?? false,
        position: input.position ?? 0,
      })
      .returning();
    return this.toCustomField(row);
  }

  async deleteCustomField(creatorUserId: string, fieldId: string) {
    const deleted = await this.db
      .delete(schema.crmCustomField)
      .where(
        and(
          eq(schema.crmCustomField.creatorUserId, creatorUserId),
          eq(schema.crmCustomField.id, fieldId),
        ),
      )
      .returning({ id: schema.crmCustomField.id });
    return deleted.length > 0;
  }

  async upsertEntityFieldValues(input: {
    creatorUserId: string;
    entityType: 'brand' | 'deal' | 'job';
    entityId: string;
    values: Record<string, string | number | boolean | null>;
  }) {
    const [row] = await this.db
      .insert(schema.crmEntityFieldValues)
      .values({
        creatorUserId: input.creatorUserId,
        entityType: input.entityType,
        entityId: input.entityId,
        values: input.values,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [
          schema.crmEntityFieldValues.creatorUserId,
          schema.crmEntityFieldValues.entityType,
          schema.crmEntityFieldValues.entityId,
        ],
        set: {
          values: input.values,
          updatedAt: new Date(),
        },
      })
      .returning();
    return this.toEntityFieldValues(row);
  }

  async createCustomRecord(input: {
    creatorUserId: string;
    objectId: string;
    title: string;
    values?: Record<string, string | number | boolean | null>;
    brandId?: string | null;
    dealId?: string | null;
    jobId?: string | null;
  }) {
    const [row] = await this.db
      .insert(schema.crmCustomRecord)
      .values({
        creatorUserId: input.creatorUserId,
        objectId: input.objectId,
        title: input.title,
        values: input.values ?? {},
        brandId: input.brandId ?? null,
        dealId: input.dealId ?? null,
        jobId: input.jobId ?? null,
      })
      .returning();
    return this.toCustomRecord(row);
  }

  async updateCustomRecord(
    creatorUserId: string,
    recordId: string,
    patch: {
      title?: string;
      values?: Record<string, string | number | boolean | null>;
      brandId?: string | null;
      dealId?: string | null;
      jobId?: string | null;
    },
  ) {
    const [row] = await this.db
      .update(schema.crmCustomRecord)
      .set({
        ...(patch.title !== undefined ? { title: patch.title } : {}),
        ...(patch.values !== undefined ? { values: patch.values } : {}),
        ...(patch.brandId !== undefined ? { brandId: patch.brandId } : {}),
        ...(patch.dealId !== undefined ? { dealId: patch.dealId } : {}),
        ...(patch.jobId !== undefined ? { jobId: patch.jobId } : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.crmCustomRecord.creatorUserId, creatorUserId),
          eq(schema.crmCustomRecord.id, recordId),
        ),
      )
      .returning();
    return row ? this.toCustomRecord(row) : null;
  }

  async deleteCustomRecord(creatorUserId: string, recordId: string) {
    const deleted = await this.db
      .delete(schema.crmCustomRecord)
      .where(
        and(
          eq(schema.crmCustomRecord.creatorUserId, creatorUserId),
          eq(schema.crmCustomRecord.id, recordId),
        ),
      )
      .returning({ id: schema.crmCustomRecord.id });
    return deleted.length > 0;
  }

  async getCustomRecord(creatorUserId: string, recordId: string) {
    const [row] = await this.db
      .select()
      .from(schema.crmCustomRecord)
      .where(
        and(
          eq(schema.crmCustomRecord.creatorUserId, creatorUserId),
          eq(schema.crmCustomRecord.id, recordId),
        ),
      )
      .limit(1);
    return row ? this.toCustomRecord(row) : null;
  }

  async createWorkflow(input: {
    creatorUserId: string;
    name: string;
    description?: string;
    enabled?: boolean;
    triggerType: CrmWorkflowTriggerType;
    triggerConfig?: Record<string, unknown>;
    actions: Array<{
      actionType: CrmWorkflowActionType;
      actionConfig?: Record<string, unknown>;
      position?: number;
    }>;
  }) {
    const [workflow] = await this.db
      .insert(schema.crmWorkflow)
      .values({
        creatorUserId: input.creatorUserId,
        name: input.name,
        description: input.description ?? '',
        enabled: input.enabled ?? true,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig ?? {},
      })
      .returning();

    const actions =
      input.actions.length === 0
        ? []
        : await this.db
            .insert(schema.crmWorkflowAction)
            .values(
              input.actions.map((action, index) => ({
                creatorUserId: input.creatorUserId,
                workflowId: workflow.id,
                position: action.position ?? index,
                actionType: action.actionType,
                actionConfig: action.actionConfig ?? {},
              })),
            )
            .returning();

    return this.toWorkflow(workflow, actions);
  }

  async updateWorkflow(
    creatorUserId: string,
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
        position?: number;
      }>;
    },
  ) {
    const [workflow] = await this.db
      .update(schema.crmWorkflow)
      .set({
        ...(patch.name !== undefined ? { name: patch.name } : {}),
        ...(patch.description !== undefined
          ? { description: patch.description }
          : {}),
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.triggerType !== undefined
          ? { triggerType: patch.triggerType }
          : {}),
        ...(patch.triggerConfig !== undefined
          ? { triggerConfig: patch.triggerConfig }
          : {}),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.crmWorkflow.creatorUserId, creatorUserId),
          eq(schema.crmWorkflow.id, workflowId),
        ),
      )
      .returning();
    if (!workflow) return null;

    let actions = await this.db
      .select()
      .from(schema.crmWorkflowAction)
      .where(eq(schema.crmWorkflowAction.workflowId, workflowId))
      .orderBy(schema.crmWorkflowAction.position);

    if (patch.actions) {
      await this.db
        .delete(schema.crmWorkflowAction)
        .where(eq(schema.crmWorkflowAction.workflowId, workflowId));
      actions =
        patch.actions.length === 0
          ? []
          : await this.db
              .insert(schema.crmWorkflowAction)
              .values(
                patch.actions.map((action, index) => ({
                  creatorUserId,
                  workflowId,
                  position: action.position ?? index,
                  actionType: action.actionType,
                  actionConfig: action.actionConfig ?? {},
                })),
              )
              .returning();
    }

    return this.toWorkflow(workflow, actions);
  }

  async deleteWorkflow(creatorUserId: string, workflowId: string) {
    const deleted = await this.db
      .delete(schema.crmWorkflow)
      .where(
        and(
          eq(schema.crmWorkflow.creatorUserId, creatorUserId),
          eq(schema.crmWorkflow.id, workflowId),
        ),
      )
      .returning({ id: schema.crmWorkflow.id });
    return deleted.length > 0;
  }

  async listEnabledWorkflowsByTrigger(
    creatorUserId: string,
    triggerType: CrmWorkflowTriggerType,
  ) {
    const workflows = await this.db
      .select()
      .from(schema.crmWorkflow)
      .where(
        and(
          eq(schema.crmWorkflow.creatorUserId, creatorUserId),
          eq(schema.crmWorkflow.triggerType, triggerType),
          eq(schema.crmWorkflow.enabled, true),
        ),
      );
    if (workflows.length === 0) return [];
    const actions = await this.db
      .select()
      .from(schema.crmWorkflowAction)
      .where(eq(schema.crmWorkflowAction.creatorUserId, creatorUserId));
    return workflows.map((row) =>
      this.toWorkflow(
        row,
        actions.filter((action) => action.workflowId === row.id),
      ),
    );
  }
}
