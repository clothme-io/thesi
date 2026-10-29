import { StripeService } from './stripe.service';

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
