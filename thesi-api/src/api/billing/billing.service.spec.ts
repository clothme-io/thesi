import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { StripeService } from 'src/shared/stripe/stripe.service';
import type {
  BillingProfileRecord,
  BillingRepository,
  BillingUser,
  InvoiceRecord,
  PaymentMethodRecord,
  UpsertBillingProfileInput,
  UpsertInvoiceInput,
} from './billing.repository';
import { BillingService } from './billing.service';

class FakeBillingRepository implements BillingRepository {
  user: BillingUser | null = {
    id: 'brand-1',
    role: 'brand',
    email: 'brand@example.com',
    fullName: 'Acme Brand',
    companyName: 'Acme Co',
  };
  profile: BillingProfileRecord | null = null;
  stripeCustomerId: string | null = null;
  methods: PaymentMethodRecord[] = [];
  invoices: InvoiceRecord[] = [];

  async getUser(userId: string) {
    return this.user?.id === userId ? this.user : null;
  }

  async getProfile() {
    return this.profile;
  }

  async upsertProfile(input: UpsertBillingProfileInput) {
    this.profile = {
      planName: 'Brand Pro',
      planPriceCents: 14900,
      billingCycle: 'monthly',
      billingEmail: input.billingEmail,
      companyName: input.companyName,
      addressLine1: input.addressLine1,
      ...(input.addressLine2 ? { addressLine2: input.addressLine2 } : {}),
      city: input.city,
      state: input.state,
      postalCode: input.postalCode,
      country: input.country,
      nextInvoiceDate: '2026-08-01',
      ...(input.taxId ? { taxId: input.taxId } : {}),
    };
    return this.profile;
  }

  async getStripeCustomerId() {
    return this.stripeCustomerId;
  }

  async saveStripeCustomerId(_brandUserId: string, stripeCustomerId: string) {
    this.stripeCustomerId = stripeCustomerId;
  }

  async listPaymentMethods() {
    return this.methods;
  }

  async replacePaymentMethods(
    _brandUserId: string,
    methods: Array<{
      stripePaymentMethodId: string;
      label: string;
      last4: string;
      expMonth: number;
      expYear: number;
      isDefault: boolean;
    }>,
  ) {
    this.methods = methods.map((method, index) => ({
      id: `pm-${index + 1}`,
      label: method.label,
      last4: method.last4,
      expMonth: method.expMonth,
      expYear: method.expYear,
      isDefault: method.isDefault,
      stripePaymentMethodId: method.stripePaymentMethodId,
    }));
    return this.methods;
  }

  async getPaymentMethod(_brandUserId: string, paymentMethodId: string) {
    return this.methods.find((method) => method.id === paymentMethodId) ?? null;
  }

  async setDefaultPaymentMethod(_brandUserId: string, paymentMethodId: string) {
    if (!this.methods.some((method) => method.id === paymentMethodId)) {
      return null;
    }
    this.methods = this.methods.map((method) => ({
      ...method,
      isDefault: method.id === paymentMethodId,
    }));
    return this.methods;
  }

  async listInvoices() {
    return this.invoices;
  }

  async getInvoice(_brandUserId: string, invoiceId: string) {
    return this.invoices.find((invoice) => invoice.id === invoiceId) ?? null;
  }

  async upsertInvoiceByStripeId(input: UpsertInvoiceInput) {
    const existing = this.invoices.find(
      (invoice) => invoice.stripeInvoiceId === input.stripeInvoiceId,
    );
    if (existing) {
      Object.assign(existing, {
        invoiceNumber: input.invoiceNumber,
        description: input.description,
        amountCents: input.amountCents,
        status: input.status,
        invoiceDate: input.invoiceDate,
      });
      return existing;
    }
    return this.createInvoice(input);
  }

  async createInvoice(input: UpsertInvoiceInput) {
    const invoice: InvoiceRecord = {
      id: `inv-${this.invoices.length + 1}`,
      invoiceNumber: input.invoiceNumber,
      description: input.description,
      amountCents: input.amountCents,
      status: input.status,
      invoiceDate: input.invoiceDate,
      ...(input.stripeInvoiceId
        ? { stripeInvoiceId: input.stripeInvoiceId }
        : {}),
    };
    this.invoices.push(invoice);
    return invoice;
  }

  async nextInvoiceNumber() {
    return `INV-TEST-${String(this.invoices.length + 1).padStart(4, '0')}`;
  }
}

describe('BillingService', () => {
  let repository: FakeBillingRepository;
  let stripe: {
    isConfigured: jest.Mock;
    createCustomer: jest.Mock;
    updateCustomer: jest.Mock;
    listCardPaymentMethods: jest.Mock;
    setDefaultPaymentMethod: jest.Mock;
    createSetupIntent: jest.Mock;
    listInvoices: jest.Mock;
  };
  let service: BillingService;

  beforeEach(() => {
    repository = new FakeBillingRepository();
    stripe = {
      isConfigured: jest.fn().mockReturnValue(false),
      createCustomer: jest.fn().mockResolvedValue('cus_test'),
      updateCustomer: jest.fn().mockResolvedValue(undefined),
      listCardPaymentMethods: jest.fn().mockResolvedValue([]),
      setDefaultPaymentMethod: jest.fn().mockResolvedValue(undefined),
      createSetupIntent: jest.fn().mockResolvedValue({
        clientSecret: null,
        setupIntentId: 'seti_test',
      }),
      listInvoices: jest.fn().mockResolvedValue([]),
    };
    service = new BillingService(
      repository,
      stripe as unknown as StripeService,
    );
  });

  it('returns default billing when no profile exists', async () => {
    const data = await service.getBilling('brand-1');
    expect(data.billing.billingEmail).toBe('brand@example.com');
    expect(data.paymentMethods).toEqual([]);
    expect(data.paymentHistory).toEqual([]);
  });

  it('updates billing profile without Stripe', async () => {
    const data = await service.updateBilling('brand-1', {
      billingEmail: 'ap@acme.com',
      companyName: 'Acme',
      addressLine1: '1 Main',
      city: 'SF',
      state: 'CA',
      postalCode: '94103',
      country: 'US',
    });
    expect(data.billing.billingEmail).toBe('ap@acme.com');
    expect(stripe.createCustomer).not.toHaveBeenCalled();
  });

  it('creates a Stripe customer when configured', async () => {
    stripe.isConfigured.mockReturnValue(true);
    await service.updateBilling('brand-1', {
      billingEmail: 'ap@acme.com',
      companyName: 'Acme',
      addressLine1: '1 Main',
      city: 'SF',
      state: 'CA',
      postalCode: '94103',
      country: 'US',
    });
    expect(stripe.createCustomer).toHaveBeenCalled();
    expect(repository.stripeCustomerId).toBe('cus_test');
  });

  it('sets the default payment method', async () => {
    repository.methods = [
      {
        id: 'pm-1',
        label: 'Visa',
        last4: '4242',
        expMonth: 8,
        expYear: 2028,
        isDefault: true,
        stripePaymentMethodId: 'pm_stripe_1',
      },
      {
        id: 'pm-2',
        label: 'Mastercard',
        last4: '8210',
        expMonth: 3,
        expYear: 2027,
        isDefault: false,
        stripePaymentMethodId: 'pm_stripe_2',
      },
    ];
    repository.stripeCustomerId = 'cus_test';
    stripe.isConfigured.mockReturnValue(true);

    const data = await service.setDefaultPaymentMethod('brand-1', 'pm-2');
    expect(data.paymentMethods.find((m) => m.id === 'pm-2')?.isDefault).toBe(
      true,
    );
    expect(stripe.setDefaultPaymentMethod).toHaveBeenCalledWith(
      'cus_test',
      'pm_stripe_2',
    );
  });

  it('rejects non-brand users', async () => {
    repository.user = {
      id: 'creator-1',
      role: 'creator',
      email: 'c@example.com',
      fullName: 'Creator',
      companyName: null,
    };
    await expect(service.getBilling('creator-1')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('fails when payment method is missing', async () => {
    await expect(
      service.setDefaultPaymentMethod('brand-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('creates a local invoice from the current plan', async () => {
    repository.profile = {
      planName: 'Brand Pro',
      planPriceCents: 14900,
      billingCycle: 'monthly',
      billingEmail: 'ap@acme.com',
      companyName: 'Acme',
      addressLine1: '1 Main',
      city: 'SF',
      state: 'CA',
      postalCode: '94103',
      country: 'US',
      nextInvoiceDate: '2026-08-01',
    };
    const data = await service.createInvoiceFromPlan('brand-1');
    expect(data.paymentHistory).toHaveLength(1);
    expect(data.paymentHistory[0].amountCents).toBe(14900);
    expect(data.paymentHistory[0].invoiceNumber).toMatch(/^INV-TEST-/);
  });

  it('builds a PDF for an invoice', async () => {
    repository.invoices.push({
      id: '11111111-1111-1111-1111-111111111111',
      invoiceNumber: 'INV-2026-0001',
      description: 'Brand Pro — 2026-07',
      amountCents: 14900,
      status: 'paid',
      invoiceDate: '2026-07-01',
    });
    const pdf = await service.getInvoicePdf(
      'brand-1',
      '11111111-1111-1111-1111-111111111111',
    );
    expect(pdf.fileName).toBe('INV-2026-0001.pdf');
    expect(pdf.buffer.subarray(0, 4).toString()).toBe('%PDF');
  });

  it('syncs Stripe invoices into payment history', async () => {
    stripe.isConfigured.mockReturnValue(true);
    repository.stripeCustomerId = 'cus_test';
    stripe.listInvoices.mockResolvedValue([
      {
        id: 'in_1',
        number: 'STRIPE-1',
        description: 'Subscription',
        amountCents: 14900,
        status: 'paid',
        invoiceDate: '2026-07-01',
        pdfUrl: null,
      },
    ]);
    const data = await service.getBilling('brand-1');
    expect(data.paymentHistory).toHaveLength(1);
    expect(data.paymentHistory[0].invoiceNumber).toBe('STRIPE-1');
  });
});
