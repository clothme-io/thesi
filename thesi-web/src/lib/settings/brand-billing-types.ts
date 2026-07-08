export interface BrandBillingInfo {
  planName: string;
  planPriceCents: number;
  billingCycle: "monthly" | "annual";
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
}

export interface BrandPaymentMethod {
  id: string;
  label: string;
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

export interface BrandPaymentHistoryEntry {
  id: string;
  date: string;
  description: string;
  amountCents: number;
  status: "paid" | "pending" | "failed";
  invoiceNumber: string;
}

export interface BrandBillingData {
  billing: BrandBillingInfo;
  paymentMethods: BrandPaymentMethod[];
  paymentHistory: BrandPaymentHistoryEntry[];
}

export function formatBillingMoney(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
