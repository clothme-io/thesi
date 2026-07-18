import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

export type StripeCustomerInput = {
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country?: string;
  };
};

export type StripeCardPaymentMethod = {
  id: string;
  label: string;
  last4: string;
  expMonth: number;
  expYear: number;
};

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe | null;

  constructor(private readonly configService: ConfigService) {
    const key = this.configService.get<string>('STRIPE_SECRET_KEY')?.trim();
    if (key) {
      this.stripe = new Stripe(key);
    } else {
      this.stripe = null;
      this.logger.warn(
        'STRIPE_SECRET_KEY is not set — billing will persist locally without Stripe sync',
      );
    }
  }

  isConfigured(): boolean {
    return this.stripe !== null;
  }

  async createCustomer(input: StripeCustomerInput): Promise<string> {
    if (!this.stripe) {
      const fakeId = `cus_local_${Date.now()}`;
      this.logger.log(`[STRIPE] createCustomer → ${fakeId}`);
      return fakeId;
    }
    const customer = await this.stripe.customers.create({
      email: input.email || undefined,
      name: input.name || undefined,
      metadata: input.metadata,
      address: input.address,
    });
    return customer.id;
  }

  async updateCustomer(
    customerId: string,
    input: StripeCustomerInput,
  ): Promise<void> {
    if (!this.stripe) {
      this.logger.log(
        `[STRIPE] updateCustomer ${customerId} ${JSON.stringify(input)}`,
      );
      return;
    }
    if (customerId.startsWith('cus_local_')) {
      return;
    }
    await this.stripe.customers.update(customerId, {
      email: input.email || undefined,
      name: input.name || undefined,
      metadata: input.metadata,
      address: input.address,
    });
  }

  async listCardPaymentMethods(
    customerId: string,
  ): Promise<StripeCardPaymentMethod[]> {
    if (!this.stripe || customerId.startsWith('cus_local_')) {
      return [];
    }
    const methods = await this.stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    });
    return methods.data.map((method) => ({
      id: method.id,
      label: this.cardLabel(method.card?.brand),
      last4: method.card?.last4 ?? '0000',
      expMonth: method.card?.exp_month ?? 1,
      expYear: method.card?.exp_year ?? 2099,
    }));
  }

  async setDefaultPaymentMethod(
    customerId: string,
    paymentMethodId: string,
  ): Promise<void> {
    if (!this.stripe || customerId.startsWith('cus_local_')) {
      this.logger.log(
        `[STRIPE] setDefaultPaymentMethod ${customerId} → ${paymentMethodId}`,
      );
      return;
    }
    await this.stripe.customers.update(customerId, {
      invoice_settings: { default_payment_method: paymentMethodId },
    });
  }

  async createSetupIntent(customerId: string): Promise<{
    clientSecret: string | null;
    setupIntentId: string;
  }> {
    if (!this.stripe || customerId.startsWith('cus_local_')) {
      const setupIntentId = `seti_local_${Date.now()}`;
      this.logger.log(`[STRIPE] createSetupIntent ${customerId} → ${setupIntentId}`);
      return { clientSecret: null, setupIntentId };
    }
    const intent = await this.stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ['card'],
      usage: 'off_session',
    });
    return {
      clientSecret: intent.client_secret,
      setupIntentId: intent.id,
    };
  }

  async listInvoices(customerId: string): Promise<
    Array<{
      id: string;
      number: string;
      description: string;
      amountCents: number;
      status: 'paid' | 'pending' | 'failed';
      invoiceDate: string;
      pdfUrl: string | null;
    }>
  > {
    if (!this.stripe || customerId.startsWith('cus_local_')) {
      return [];
    }

    const invoices = await this.stripe.invoices.list({
      customer: customerId,
      limit: 50,
    });

    return invoices.data.map((invoice) => {
      const status = this.mapInvoiceStatus(invoice.status);
      const cents =
        invoice.amount_paid ||
        invoice.amount_due ||
        invoice.total ||
        0;
      return {
        id: invoice.id,
        number:
          invoice.number ||
          `STRIPE-${invoice.id.replace(/^in_/, '').slice(0, 8).toUpperCase()}`,
        description:
          invoice.description ||
          invoice.lines.data[0]?.description ||
          'Stripe invoice',
        amountCents: Math.abs(cents),
        status,
        invoiceDate: new Date(
          (invoice.created || 0) * 1000,
        )
          .toISOString()
          .slice(0, 10),
        pdfUrl: invoice.invoice_pdf ?? null,
      };
    });
  }

  async createExpressAccount(input: {
    email?: string;
    creatorUserId: string;
  }): Promise<string> {
    if (!this.stripe) {
      const fakeId = `acct_local_${Date.now()}`;
      this.logger.log(`[STRIPE] createExpressAccount → ${fakeId}`);
      return fakeId;
    }
    const account = await this.stripe.accounts.create({
      type: 'express',
      email: input.email || undefined,
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        creatorUserId: input.creatorUserId,
        channel: 'thesi-creator',
      },
    });
    return account.id;
  }

  async createAccountLink(input: {
    accountId: string;
    refreshUrl: string;
    returnUrl: string;
  }): Promise<{ url: string; expiresAt: number }> {
    if (!this.stripe || input.accountId.startsWith('acct_local_')) {
      this.logger.log(
        `[STRIPE] createAccountLink ${input.accountId} (local stub)`,
      );
      return {
        url: input.returnUrl,
        expiresAt: Math.floor(Date.now() / 1000) + 3600,
      };
    }
    const link = await this.stripe.accountLinks.create({
      account: input.accountId,
      refresh_url: input.refreshUrl,
      return_url: input.returnUrl,
      type: 'account_onboarding',
    });
    return { url: link.url, expiresAt: link.expires_at };
  }

  async retrieveConnectAccount(accountId: string): Promise<{
    accountId: string;
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
  }> {
    if (!this.stripe || accountId.startsWith('acct_local_')) {
      return {
        accountId,
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: false,
      };
    }
    const account = await this.stripe.accounts.retrieve(accountId);
    return {
      accountId: account.id,
      chargesEnabled: Boolean(account.charges_enabled),
      payoutsEnabled: Boolean(account.payouts_enabled),
      detailsSubmitted: Boolean(account.details_submitted),
    };
  }

  async createLoginLink(accountId: string): Promise<{ url: string }> {
    if (!this.stripe || accountId.startsWith('acct_local_')) {
      this.logger.log(`[STRIPE] createLoginLink ${accountId} (local stub)`);
      return { url: '' };
    }
    const link = await this.stripe.accounts.createLoginLink(accountId);
    return { url: link.url };
  }

  async createTransfer(input: {
    amountCents: number;
    currency?: string;
    destinationAccountId: string;
    idempotencyKey: string;
    transferGroup?: string;
    metadata?: Record<string, string>;
  }): Promise<{ transferId: string }> {
    if (input.amountCents <= 0) {
      throw new Error('Transfer amount must be positive');
    }

    if (
      !this.stripe ||
      input.destinationAccountId.startsWith('acct_local_')
    ) {
      const transferId = `tr_local_${Date.now()}`;
      this.logger.log(
        `[STRIPE] createTransfer ${input.amountCents} → ${input.destinationAccountId} ${transferId}`,
      );
      return { transferId };
    }

    const transfer = await this.stripe.transfers.create(
      {
        amount: input.amountCents,
        currency: (input.currency || 'usd').toLowerCase(),
        destination: input.destinationAccountId,
        transfer_group: input.transferGroup,
        metadata: input.metadata,
      },
      { idempotencyKey: input.idempotencyKey },
    );
    return { transferId: transfer.id };
  }

  isWebhookConfigured(): boolean {
    const secret = this.configService
      .get<string>('STRIPE_WEBHOOK_SECRET')
      ?.trim();
    return Boolean(this.stripe && secret);
  }

  /**
   * Verify a Stripe webhook signature when configured.
   * Without STRIPE_WEBHOOK_SECRET (local), parse the JSON payload directly.
   */
  constructWebhookEvent(
    rawBody: Buffer | undefined,
    signature: string | undefined,
  ): Stripe.Event {
    if (!rawBody?.length) {
      throw new Error('Webhook body is required');
    }

    const secret = this.configService
      .get<string>('STRIPE_WEBHOOK_SECRET')
      ?.trim();

    if (this.stripe && secret) {
      if (!signature) {
        throw new Error('Stripe-Signature header is required');
      }
      return this.stripe.webhooks.constructEvent(rawBody, signature, secret);
    }

    this.logger.warn(
      '[STRIPE] webhook secret unset — accepting unsigned local payload',
    );
    const parsed = JSON.parse(rawBody.toString('utf8')) as Stripe.Event;
    if (!parsed?.id || !parsed?.type) {
      throw new Error('Invalid Stripe event payload');
    }
    return parsed;
  }

  async chargeOffSession(input: {
    customerId: string;
    paymentMethodId: string;
    amountCents: number;
    currency?: string;
    description: string;
    idempotencyKey: string;
    metadata?: Record<string, string>;
  }): Promise<{ paymentIntentId: string; status: 'succeeded' | 'processing' }> {
    if (input.amountCents <= 0) {
      return { paymentIntentId: `pi_zero_${Date.now()}`, status: 'succeeded' };
    }

    if (
      !this.stripe ||
      input.customerId.startsWith('cus_local_') ||
      input.paymentMethodId.startsWith('pm_local_')
    ) {
      const paymentIntentId = `pi_local_${Date.now()}`;
      this.logger.log(
        `[STRIPE] chargeOffSession ${input.customerId} ${input.amountCents} → ${paymentIntentId}`,
      );
      return { paymentIntentId, status: 'succeeded' };
    }

    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amountCents,
        currency: (input.currency || 'usd').toLowerCase(),
        customer: input.customerId,
        payment_method: input.paymentMethodId,
        off_session: true,
        confirm: true,
        description: input.description,
        metadata: input.metadata,
      },
      { idempotencyKey: input.idempotencyKey },
    );

    if (intent.status !== 'succeeded' && intent.status !== 'processing') {
      throw new Error(
        `PaymentIntent status ${intent.status} — platform fee not collected`,
      );
    }

    return {
      paymentIntentId: intent.id,
      status: intent.status === 'succeeded' ? 'succeeded' : 'processing',
    };
  }

  private mapInvoiceStatus(
    status: string | null,
  ): 'paid' | 'pending' | 'failed' {
    if (status === 'paid') return 'paid';
    if (status === 'uncollectible' || status === 'void') return 'failed';
    return 'pending';
  }

  private cardLabel(brand?: string | null): string {
    if (!brand) return 'Card';
    return brand.charAt(0).toUpperCase() + brand.slice(1);
  }
}
