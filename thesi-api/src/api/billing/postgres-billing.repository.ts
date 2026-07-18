import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DrizzleAsyncProvider } from 'src/dbConfig/drizzle/drizzle.provider';
import * as schema from 'src/dbConfig/drizzle/schema';
import type {
  BillingProfileRecord,
  BillingRepository,
  BillingUser,
  InvoiceRecord,
  PaymentMethodRecord,
  UpsertBillingProfileInput,
  UpsertInvoiceInput,
} from './billing.repository';

function dateStr(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
}

function nextMonthFirst(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))
    .toISOString()
    .slice(0, 10);
}

@Injectable()
export class PostgresBillingRepository implements BillingRepository {
  constructor(
    @Inject(DrizzleAsyncProvider)
    private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async getUser(userId: string): Promise<BillingUser | null> {
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

  async getProfile(brandUserId: string): Promise<BillingProfileRecord | null> {
    const [row] = await this.db
      .select()
      .from(schema.brandBillingProfile)
      .where(eq(schema.brandBillingProfile.brandUserId, brandUserId))
      .limit(1);
    return row ? this.toProfile(row) : null;
  }

  async upsertProfile(input: UpsertBillingProfileInput) {
    const existing = await this.getProfile(input.brandUserId);
    if (!existing) {
      const [row] = await this.db
        .insert(schema.brandBillingProfile)
        .values({
          brandUserId: input.brandUserId,
          billingEmail: input.billingEmail,
          companyName: input.companyName,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 ?? '',
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          country: input.country,
          taxId: input.taxId?.trim() || null,
          nextInvoiceDate: nextMonthFirst(),
        })
        .returning();
      return this.toProfile(row);
    }

    const [row] = await this.db
      .update(schema.brandBillingProfile)
      .set({
        billingEmail: input.billingEmail,
        companyName: input.companyName,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2 ?? '',
        city: input.city,
        state: input.state,
        postalCode: input.postalCode,
        country: input.country,
        taxId: input.taxId?.trim() || null,
        updatedAt: new Date(),
      })
      .where(eq(schema.brandBillingProfile.brandUserId, input.brandUserId))
      .returning();
    return this.toProfile(row);
  }

  async getStripeCustomerId(brandUserId: string) {
    const [row] = await this.db
      .select({
        stripeCustomerId: schema.brandStripeCustomer.stripeCustomerId,
      })
      .from(schema.brandStripeCustomer)
      .where(eq(schema.brandStripeCustomer.brandUserId, brandUserId))
      .limit(1);
    return row?.stripeCustomerId ?? null;
  }

  async saveStripeCustomerId(brandUserId: string, stripeCustomerId: string) {
    await this.db
      .insert(schema.brandStripeCustomer)
      .values({ brandUserId, stripeCustomerId })
      .onConflictDoUpdate({
        target: schema.brandStripeCustomer.brandUserId,
        set: { stripeCustomerId, updatedAt: new Date() },
      });
  }

  async listPaymentMethods(brandUserId: string) {
    const rows = await this.db
      .select()
      .from(schema.brandPaymentMethod)
      .where(eq(schema.brandPaymentMethod.brandUserId, brandUserId));
    return rows.map((row) => this.toPaymentMethod(row));
  }

  async replacePaymentMethods(
    brandUserId: string,
    methods: Array<{
      stripePaymentMethodId: string;
      label: string;
      last4: string;
      expMonth: number;
      expYear: number;
      isDefault: boolean;
    }>,
  ) {
    await this.db
      .delete(schema.brandPaymentMethod)
      .where(eq(schema.brandPaymentMethod.brandUserId, brandUserId));

    if (methods.length === 0) return [];

    const rows = await this.db
      .insert(schema.brandPaymentMethod)
      .values(
        methods.map((method) => ({
          brandUserId,
          stripePaymentMethodId: method.stripePaymentMethodId,
          label: method.label,
          last4: method.last4,
          expMonth: method.expMonth,
          expYear: method.expYear,
          isDefault: method.isDefault,
        })),
      )
      .returning();
    return rows.map((row) => this.toPaymentMethod(row));
  }

  async getPaymentMethod(brandUserId: string, paymentMethodId: string) {
    const [row] = await this.db
      .select()
      .from(schema.brandPaymentMethod)
      .where(
        and(
          eq(schema.brandPaymentMethod.brandUserId, brandUserId),
          eq(schema.brandPaymentMethod.id, paymentMethodId),
        ),
      )
      .limit(1);
    return row ? this.toPaymentMethod(row) : null;
  }

  async setDefaultPaymentMethod(brandUserId: string, paymentMethodId: string) {
    const method = await this.getPaymentMethod(brandUserId, paymentMethodId);
    if (!method) return null;

    await this.db
      .update(schema.brandPaymentMethod)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(schema.brandPaymentMethod.brandUserId, brandUserId));

    await this.db
      .update(schema.brandPaymentMethod)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(
        and(
          eq(schema.brandPaymentMethod.brandUserId, brandUserId),
          eq(schema.brandPaymentMethod.id, paymentMethodId),
        ),
      );

    return this.listPaymentMethods(brandUserId);
  }

  async listInvoices(brandUserId: string) {
    const rows = await this.db
      .select()
      .from(schema.brandInvoice)
      .where(eq(schema.brandInvoice.brandUserId, brandUserId))
      .orderBy(desc(schema.brandInvoice.invoiceDate));
    return rows.map((row) => this.toInvoice(row));
  }

  async getInvoice(brandUserId: string, invoiceId: string) {
    const [row] = await this.db
      .select()
      .from(schema.brandInvoice)
      .where(
        and(
          eq(schema.brandInvoice.brandUserId, brandUserId),
          eq(schema.brandInvoice.id, invoiceId),
        ),
      )
      .limit(1);
    return row ? this.toInvoice(row) : null;
  }

  async upsertInvoiceByStripeId(input: UpsertInvoiceInput) {
    if (!input.stripeInvoiceId) {
      return this.createInvoice(input);
    }

    const [existing] = await this.db
      .select()
      .from(schema.brandInvoice)
      .where(eq(schema.brandInvoice.stripeInvoiceId, input.stripeInvoiceId))
      .limit(1);

    if (existing) {
      const [row] = await this.db
        .update(schema.brandInvoice)
        .set({
          invoiceNumber: input.invoiceNumber,
          description: input.description,
          amountCents: input.amountCents,
          status: input.status,
          invoiceDate: input.invoiceDate,
          updatedAt: new Date(),
        })
        .where(eq(schema.brandInvoice.id, existing.id))
        .returning();
      return this.toInvoice(row);
    }

    return this.createInvoice(input);
  }

  async createInvoice(input: UpsertInvoiceInput) {
    const [row] = await this.db
      .insert(schema.brandInvoice)
      .values({
        brandUserId: input.brandUserId,
        invoiceNumber: input.invoiceNumber,
        description: input.description,
        amountCents: input.amountCents,
        status: input.status,
        invoiceDate: input.invoiceDate,
        stripeInvoiceId: input.stripeInvoiceId ?? null,
      })
      .returning();
    return this.toInvoice(row);
  }

  async nextInvoiceNumber(brandUserId: string) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.brandInvoice)
      .where(eq(schema.brandInvoice.brandUserId, brandUserId));
    const seq = (row?.count ?? 0) + 1;
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `INV-${stamp}-${String(seq).padStart(4, '0')}`;
  }

  private toInvoice(
    row: typeof schema.brandInvoice.$inferSelect,
  ): InvoiceRecord {
    return {
      id: row.id,
      invoiceNumber: row.invoiceNumber,
      description: row.description,
      amountCents: row.amountCents,
      status: row.status as InvoiceRecord['status'],
      invoiceDate: dateStr(row.invoiceDate),
      ...(row.stripeInvoiceId ? { stripeInvoiceId: row.stripeInvoiceId } : {}),
    };
  }

  private toProfile(
    row: typeof schema.brandBillingProfile.$inferSelect,
  ): BillingProfileRecord {
    return {
      planName: row.planName,
      planPriceCents: row.planPriceCents,
      billingCycle: row.billingCycle as BillingProfileRecord['billingCycle'],
      billingEmail: row.billingEmail,
      companyName: row.companyName,
      addressLine1: row.addressLine1,
      ...(row.addressLine2 ? { addressLine2: row.addressLine2 } : {}),
      city: row.city,
      state: row.state,
      postalCode: row.postalCode,
      country: row.country,
      nextInvoiceDate: dateStr(row.nextInvoiceDate) || nextMonthFirst(),
      ...(row.taxId ? { taxId: row.taxId } : {}),
    };
  }

  private toPaymentMethod(
    row: typeof schema.brandPaymentMethod.$inferSelect,
  ): PaymentMethodRecord {
    return {
      id: row.id,
      label: row.label,
      last4: row.last4,
      expMonth: row.expMonth,
      expYear: row.expYear,
      isDefault: row.isDefault,
      ...(row.stripePaymentMethodId
        ? { stripePaymentMethodId: row.stripePaymentMethodId }
        : {}),
    };
  }
}
