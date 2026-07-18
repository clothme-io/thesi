export const BILLING_REPOSITORY = Symbol('BILLING_REPOSITORY');

export type BillingUser = {
  id: string;
  role: string;
  email: string;
  fullName: string;
  companyName: string | null;
};

export type BillingProfileRecord = {
  planName: string;
  planPriceCents: number;
  billingCycle: 'monthly' | 'annual';
  billingEmail: string;
  companyName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  nextInvoiceDate: string;
  taxId?: string;
};

export type PaymentMethodRecord = {
  id: string;
  label: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
  stripePaymentMethodId?: string;
};

export type UpsertBillingProfileInput = {
  brandUserId: string;
  billingEmail: string;
  companyName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  taxId?: string;
};

export type InvoiceRecord = {
  id: string;
  invoiceNumber: string;
  description: string;
  amountCents: number;
  status: 'paid' | 'pending' | 'failed';
  invoiceDate: string;
  stripeInvoiceId?: string;
};

export type UpsertInvoiceInput = {
  brandUserId: string;
  invoiceNumber: string;
  description: string;
  amountCents: number;
  status: InvoiceRecord['status'];
  invoiceDate: string;
  stripeInvoiceId?: string | null;
};

export interface BillingRepository {
  getUser(userId: string): Promise<BillingUser | null>;
  getProfile(brandUserId: string): Promise<BillingProfileRecord | null>;
  upsertProfile(input: UpsertBillingProfileInput): Promise<BillingProfileRecord>;
  getStripeCustomerId(brandUserId: string): Promise<string | null>;
  saveStripeCustomerId(
    brandUserId: string,
    stripeCustomerId: string,
  ): Promise<void>;
  listPaymentMethods(brandUserId: string): Promise<PaymentMethodRecord[]>;
  replacePaymentMethods(
    brandUserId: string,
    methods: Array<{
      stripePaymentMethodId: string;
      label: string;
      last4: string;
      expMonth: number;
      expYear: number;
      isDefault: boolean;
    }>,
  ): Promise<PaymentMethodRecord[]>;
  setDefaultPaymentMethod(
    brandUserId: string,
    paymentMethodId: string,
  ): Promise<PaymentMethodRecord[] | null>;
  getPaymentMethod(
    brandUserId: string,
    paymentMethodId: string,
  ): Promise<PaymentMethodRecord | null>;
  listInvoices(brandUserId: string): Promise<InvoiceRecord[]>;
  getInvoice(
    brandUserId: string,
    invoiceId: string,
  ): Promise<InvoiceRecord | null>;
  upsertInvoiceByStripeId(input: UpsertInvoiceInput): Promise<InvoiceRecord>;
  createInvoice(input: UpsertInvoiceInput): Promise<InvoiceRecord>;
  nextInvoiceNumber(brandUserId: string): Promise<string>;
}
