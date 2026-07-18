import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { StripeService } from 'src/shared/stripe/stripe.service';
import {
  BILLING_REPOSITORY,
  type BillingProfileRecord,
  type BillingRepository,
  type InvoiceRecord,
  type PaymentMethodRecord,
} from './billing.repository';
import { buildInvoicePdf } from './invoice-pdf';

export type BrandBillingData = {
  billing: BillingProfileRecord;
  paymentMethods: Array<{
    id: string;
    label: string;
    last4: string;
    expMonth: number;
    expYear: number;
    isDefault: boolean;
  }>;
  paymentHistory: Array<{
    id: string;
    date: string;
    description: string;
    amountCents: number;
    status: 'paid' | 'pending' | 'failed';
    invoiceNumber: string;
  }>;
};

function defaultProfile(user: {
  email: string;
  fullName: string;
  companyName: string | null;
}): BillingProfileRecord {
  const next = new Date();
  next.setUTCMonth(next.getUTCMonth() + 1, 1);
  return {
    planName: 'Brand Pro',
    planPriceCents: 14900,
    billingCycle: 'monthly',
    billingEmail: user.email,
    companyName: user.companyName ?? user.fullName,
    addressLine1: '',
    city: '',
    state: '',
    postalCode: '',
    country: '',
    nextInvoiceDate: next.toISOString().slice(0, 10),
  };
}

function toPublicMethods(methods: PaymentMethodRecord[]) {
  return methods.map(({ stripePaymentMethodId: _id, ...method }) => method);
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(BILLING_REPOSITORY)
    private readonly billing: BillingRepository,
    private readonly stripe: StripeService,
  ) {}

  async getBilling(userId: string): Promise<BrandBillingData> {
    const user = await this.requireBrand(userId);
    const profile =
      (await this.billing.getProfile(userId)) ?? defaultProfile(user);
    const paymentMethods = await this.syncPaymentMethods(userId, profile);
    const paymentHistory = await this.loadPaymentHistory(userId, profile);
    return {
      billing: profile,
      paymentMethods: toPublicMethods(paymentMethods),
      paymentHistory,
    };
  }

  async updateBilling(
    userId: string,
    input: {
      billingEmail: string;
      companyName: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      state: string;
      postalCode: string;
      country: string;
      taxId?: string;
    },
  ): Promise<BrandBillingData> {
    await this.requireBrand(userId);
    const profile = await this.billing.upsertProfile({
      brandUserId: userId,
      billingEmail: input.billingEmail.trim(),
      companyName: input.companyName.trim(),
      addressLine1: input.addressLine1.trim(),
      addressLine2: input.addressLine2?.trim(),
      city: input.city.trim(),
      state: input.state.trim(),
      postalCode: input.postalCode.trim(),
      country: input.country.trim(),
      taxId: input.taxId?.trim(),
    });

    if (this.stripe.isConfigured()) {
      await this.ensureStripeCustomer(userId, profile);
    }

    const paymentMethods = await this.syncPaymentMethods(userId, profile);
    const paymentHistory = await this.loadPaymentHistory(userId, profile);
    return {
      billing: profile,
      paymentMethods: toPublicMethods(paymentMethods),
      paymentHistory,
    };
  }

  async setDefaultPaymentMethod(
    userId: string,
    paymentMethodId: string,
  ): Promise<BrandBillingData> {
    await this.requireBrand(userId);
    const method = await this.billing.getPaymentMethod(userId, paymentMethodId);
    if (!method) {
      throw new NotFoundException('Payment method not found');
    }

    const methods = await this.billing.setDefaultPaymentMethod(
      userId,
      paymentMethodId,
    );
    if (!methods) {
      throw new NotFoundException('Payment method not found');
    }

    const customerId = await this.billing.getStripeCustomerId(userId);
    if (customerId && method.stripePaymentMethodId) {
      await this.stripe.setDefaultPaymentMethod(
        customerId,
        method.stripePaymentMethodId,
      );
    }

    const profile =
      (await this.billing.getProfile(userId)) ??
      defaultProfile(await this.requireBrand(userId));

    const paymentHistory = await this.loadPaymentHistory(userId, profile);
    return {
      billing: profile,
      paymentMethods: toPublicMethods(methods),
      paymentHistory,
    };
  }

  async createSetupIntent(userId: string): Promise<{
    clientSecret: string | null;
    setupIntentId: string;
    stripeConfigured: boolean;
  }> {
    const user = await this.requireBrand(userId);
    const profile =
      (await this.billing.getProfile(userId)) ?? defaultProfile(user);
    const customerId = await this.ensureStripeCustomer(userId, profile);
    const intent = await this.stripe.createSetupIntent(customerId);
    return {
      ...intent,
      stripeConfigured: this.stripe.isConfigured(),
    };
  }

  async createInvoiceFromPlan(userId: string): Promise<BrandBillingData> {
    const user = await this.requireBrand(userId);
    const profile =
      (await this.billing.getProfile(userId)) ?? defaultProfile(user);
    const invoiceNumber = await this.billing.nextInvoiceNumber(userId);
    const now = new Date().toISOString().slice(0, 10);
    await this.billing.createInvoice({
      brandUserId: userId,
      invoiceNumber,
      description: `${profile.planName} — ${now.slice(0, 7)}`,
      amountCents: profile.planPriceCents,
      status: 'paid',
      invoiceDate: now,
    });
    return this.getBilling(userId);
  }

  async getInvoicePdf(
    userId: string,
    invoiceId: string,
  ): Promise<{ fileName: string; buffer: Buffer }> {
    const user = await this.requireBrand(userId);
    const invoice = await this.billing.getInvoice(userId, invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const profile =
      (await this.billing.getProfile(userId)) ?? defaultProfile(user);
    const buffer = buildInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      description: invoice.description,
      amountCents: invoice.amountCents,
      status: invoice.status,
      invoiceDate: invoice.invoiceDate,
      companyName: profile.companyName || user.fullName,
      billingEmail: profile.billingEmail || user.email,
      addressLines: [
        profile.addressLine1,
        profile.addressLine2 ?? '',
        [profile.city, profile.state, profile.postalCode]
          .filter(Boolean)
          .join(', '),
        profile.country,
      ],
    });
    return {
      fileName: `${invoice.invoiceNumber}.pdf`,
      buffer,
    };
  }

  private async loadPaymentHistory(
    brandUserId: string,
    profile: BillingProfileRecord,
  ): Promise<BrandBillingData['paymentHistory']> {
    await this.syncStripeInvoices(brandUserId, profile);
    const invoices = await this.billing.listInvoices(brandUserId);
    return invoices.map((invoice) => this.toHistoryEntry(invoice));
  }

  private async syncStripeInvoices(
    brandUserId: string,
    profile: BillingProfileRecord,
  ): Promise<void> {
    if (!this.stripe.isConfigured()) return;
    const customerId = await this.billing.getStripeCustomerId(brandUserId);
    if (!customerId) return;

    const remote = await this.stripe.listInvoices(customerId);
    for (const invoice of remote) {
      await this.billing.upsertInvoiceByStripeId({
        brandUserId,
        invoiceNumber: invoice.number,
        description: invoice.description || `${profile.planName} invoice`,
        amountCents: invoice.amountCents,
        status: invoice.status,
        invoiceDate: invoice.invoiceDate,
        stripeInvoiceId: invoice.id,
      });
    }
  }

  private toHistoryEntry(invoice: InvoiceRecord) {
    return {
      id: invoice.id,
      date: invoice.invoiceDate,
      description: invoice.description,
      amountCents: invoice.amountCents,
      status: invoice.status,
      invoiceNumber: invoice.invoiceNumber,
    };
  }

  private async ensureStripeCustomer(
    brandUserId: string,
    profile: BillingProfileRecord,
  ): Promise<string> {
    const existing = await this.billing.getStripeCustomerId(brandUserId);
    const payload = {
      email: profile.billingEmail || undefined,
      name: profile.companyName || undefined,
      metadata: { brandUserId },
      address: {
        line1: profile.addressLine1 || undefined,
        line2: profile.addressLine2 || undefined,
        city: profile.city || undefined,
        state: profile.state || undefined,
        postal_code: profile.postalCode || undefined,
        country: profile.country || undefined,
      },
    };

    if (existing) {
      await this.stripe.updateCustomer(existing, payload);
      return existing;
    }

    const customerId = await this.stripe.createCustomer(payload);
    await this.billing.saveStripeCustomerId(brandUserId, customerId);
    return customerId;
  }

  private async syncPaymentMethods(
    brandUserId: string,
    profile: BillingProfileRecord,
  ): Promise<PaymentMethodRecord[]> {
    if (!this.stripe.isConfigured()) {
      return this.billing.listPaymentMethods(brandUserId);
    }

    const customerId = await this.ensureStripeCustomer(brandUserId, profile);
    const remote = await this.stripe.listCardPaymentMethods(customerId);
    if (remote.length === 0) {
      return this.billing.replacePaymentMethods(brandUserId, []);
    }

    const existing = await this.billing.listPaymentMethods(brandUserId);
    const defaultStripeId =
      existing.find((method) => method.isDefault)?.stripePaymentMethodId ??
      remote[0]?.id;

    const chosenDefault = defaultStripeId ?? remote[0].id;
    return this.billing.replacePaymentMethods(
      brandUserId,
      remote.map((method) => ({
        stripePaymentMethodId: method.id,
        label: method.label,
        last4: method.last4,
        expMonth: method.expMonth,
        expYear: method.expYear,
        isDefault: method.id === chosenDefault,
      })),
    );
  }

  /**
   * Resolve Stripe customer + default payment method for off-session charges.
   * When Stripe is not configured, returns local stub ids.
   */
  async resolveChargeContext(userId: string): Promise<{
    customerId: string;
    paymentMethodId: string;
    stripeConfigured: boolean;
  } | null> {
    await this.requireBrand(userId);
    const profile =
      (await this.billing.getProfile(userId)) ??
      defaultProfile(await this.requireBrand(userId));

    if (!this.stripe.isConfigured()) {
      const customerId =
        (await this.billing.getStripeCustomerId(userId)) ??
        (await this.ensureStripeCustomer(userId, profile));
      return {
        customerId,
        paymentMethodId: 'pm_local_default',
        stripeConfigured: false,
      };
    }

    const methods = await this.syncPaymentMethods(userId, profile);
    const defaultMethod = methods.find((method) => method.isDefault) ?? methods[0];
    if (!defaultMethod?.stripePaymentMethodId) {
      return null;
    }
    const customerId = await this.ensureStripeCustomer(userId, profile);
    return {
      customerId,
      paymentMethodId: defaultMethod.stripePaymentMethodId,
      stripeConfigured: true,
    };
  }

  async recordPlatformFeeInvoice(input: {
    brandUserId: string;
    campaignName: string;
    feeCents: number;
    stripePaymentIntentId?: string;
  }): Promise<void> {
    if (input.feeCents <= 0) return;
    const invoiceNumber = await this.billing.nextInvoiceNumber(
      input.brandUserId,
    );
    await this.billing.createInvoice({
      brandUserId: input.brandUserId,
      invoiceNumber,
      description: `Campaign platform fee — ${input.campaignName}`,
      amountCents: input.feeCents,
      status: 'paid',
      invoiceDate: new Date().toISOString().slice(0, 10),
      stripeInvoiceId: input.stripePaymentIntentId ?? null,
    });
  }

  private async requireBrand(userId: string) {
    const user = await this.billing.getUser(userId);
    if (!user) {
      throw new NotFoundException('User account not found');
    }
    if (user.role !== 'brand') {
      throw new ForbiddenException('Brand account required');
    }
    return user;
  }
}
