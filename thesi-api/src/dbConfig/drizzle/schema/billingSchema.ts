import {
  boolean,
  date,
  integer,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { thesiUser } from './userSchema';

const thesiSchema = pgSchema('thesi');

export const brandBillingProfile = thesiSchema.table('brand_billing_profile', {
  brandUserId: text('brand_user_id')
    .primaryKey()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  planName: text('plan_name').notNull().default('Brand Pro'),
  planPriceCents: integer('plan_price_cents').notNull().default(14900),
  billingCycle: text('billing_cycle').notNull().default('monthly'),
  billingEmail: text('billing_email').notNull().default(''),
  companyName: text('company_name').notNull().default(''),
  addressLine1: text('address_line1').notNull().default(''),
  addressLine2: text('address_line2').notNull().default(''),
  city: text('city').notNull().default(''),
  state: text('state').notNull().default(''),
  postalCode: text('postal_code').notNull().default(''),
  country: text('country').notNull().default(''),
  nextInvoiceDate: date('next_invoice_date'),
  taxId: text('tax_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const brandStripeCustomer = thesiSchema.table('brand_stripe_customer', {
  brandUserId: text('brand_user_id')
    .primaryKey()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const brandPaymentMethod = thesiSchema.table('brand_payment_method', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandUserId: text('brand_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  stripePaymentMethodId: text('stripe_payment_method_id'),
  label: text('label').notNull(),
  last4: text('last4').notNull(),
  expMonth: integer('exp_month').notNull(),
  expYear: integer('exp_year').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const brandInvoice = thesiSchema.table('brand_invoice', {
  id: uuid('id').primaryKey().defaultRandom(),
  brandUserId: text('brand_user_id')
    .notNull()
    .references(() => thesiUser.id, { onDelete: 'cascade' }),
  invoiceNumber: text('invoice_number').notNull(),
  description: text('description').notNull(),
  amountCents: integer('amount_cents').notNull(),
  status: text('status').notNull().default('pending'),
  invoiceDate: date('invoice_date').notNull(),
  stripeInvoiceId: text('stripe_invoice_id').unique(),
  pdfStorageKey: text('pdf_storage_key'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
