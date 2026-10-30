import { StripeService } from './stripe.service';
import Stripe from 'stripe';

function service(config: Record<string, string> = {}) {
  return new StripeService({
    get: (key: string) => config[key],
  } as any);
}

const event = Buffer.from(
  JSON.stringify({ id: 'evt_local', type: 'payment_intent.succeeded' }),
);

describe('StripeService webhook verification', () => {
  it('rejects unsigned webhooks when an API key is configured without a signing secret', () => {
    expect(() =>
      service({ STRIPE_SECRET_KEY: 'sk_test_fixture' }).constructWebhookEvent(
        event,
        undefined,
      ),
    ).toThrow('STRIPE_WEBHOOK_SECRET is required');
  });

  it('rejects unsigned webhooks in production without an API key', () => {
    expect(() =>
      service({ NODE_ENV: 'production' }).constructWebhookEvent(event, undefined),
    ).toThrow('Unsigned Stripe webhooks are disabled in production');
  });

  it('accepts local fixture webhooks when Stripe is not configured', () => {
    expect(service().constructWebhookEvent(event, undefined).id).toBe('evt_local');
  });
});

describe('StripeService customer setup', () => {
  it('returns only a publishable key matching the API key mode', () => {
    expect(service({ STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_PUBLISHABLE_KEY: 'pk_test_fixture' }).getPublishableKey()).toBe('pk_test_fixture');
    expect(service({ STRIPE_SECRET_KEY: 'sk_test_fixture', STRIPE_PUBLISHABLE_KEY: 'pk_live_fixture' }).getPublishableKey()).toBeNull();
  });

  it('replaces a local customer without calling Stripe update', async () => {
    const stripeService = service({ STRIPE_SECRET_KEY: 'sk_test_fixture' });
    const customerUpdate = jest.spyOn((stripeService as any).stripe.customers, 'update');

    await expect(stripeService.updateCustomer('cus_local_123', {})).resolves.toBe(false);
    expect(customerUpdate).not.toHaveBeenCalled();
  });

  it('replaces a customer missing from the current Stripe mode', async () => {
    const stripeService = service({ STRIPE_SECRET_KEY: 'sk_test_fixture' });
    jest.spyOn((stripeService as any).stripe.customers, 'update').mockRejectedValue(
      new Stripe.errors.StripeInvalidRequestError({
        statusCode: 404,
        code: 'resource_missing',
      }),
    );

    await expect(stripeService.updateCustomer('cus_from_other_mode', {})).resolves.toBe(false);
  });
});
