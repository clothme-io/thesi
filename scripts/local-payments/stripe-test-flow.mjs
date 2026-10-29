// Run only against a Stripe test account. Creates a test brand charge and refunds it.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'thesi-api/package.json'));
const Stripe = require('stripe');
const { FundingGateway } = require(path.join(root, 'thesi-api/dist/api/campaign-funding/funding.gateway.js'));
const env = Object.fromEntries(
  (await readFile(path.join(root, 'thesi-api/.env'), 'utf8'))
    .split('\n')
    .filter((line) => line.includes('=') && !line.trimStart().startsWith('#'))
    .map((line) => {
      const at = line.indexOf('=');
      return [line.slice(0, at).trim(), line.slice(at + 1).trim().replace(/^['"]|['"]$/g, '')];
    }),
);
assert.match(env.STRIPE_SECRET_KEY ?? '', /^sk_test_/);
assert.match(env.STRIPE_PLATFORM_ACCOUNT_ID ?? '', /^acct_/);
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 0 });
const platform = await stripe.accounts.retrieve();
assert.equal(platform.id, env.STRIPE_PLATFORM_ACCOUNT_ID);
const gateway = new FundingGateway({
  get: (key) => key === 'CAMPAIGN_FUNDING_ENABLED' ? true : env[key],
  getOrThrow: (key) => {
    if (!env[key]) throw new Error(`${key} missing`);
    return env[key];
  },
});
const runId = randomUUID();
const customer = await stripe.customers.create({
  email: `thesi-e2e-${runId}@example.test`,
  metadata: { purpose: 'thesi_test_flow', runId },
});
const card = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } });
await stripe.paymentMethods.attach(card.id, { customer: customer.id });
await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: card.id } });
const campaignId = randomUUID();
const deposit = await gateway.execute({
  id: randomUUID(),
  campaign_id: campaignId,
  kind: 'deposit',
  amount_cents: 30000,
  args: { customerId: customer.id, paymentMethodId: card.id },
});
assert.ok(deposit.chargeId);
assert.equal(deposit.pending, undefined);
const refund = await gateway.execute({
  id: randomUUID(),
  campaign_id: campaignId,
  kind: 'refund_unused',
  amount_cents: 10000,
  args: {
    chargeId: deposit.chargeId,
    paymentIntentId: deposit.id,
    expectedRefundCents: 0,
  },
});
assert.equal(refund.pending, false);
const remaining = await gateway.execute({
  id: randomUUID(),
  campaign_id: campaignId,
  kind: 'refund_cancelled',
  amount_cents: 20000,
  args: {
    chargeId: deposit.chargeId,
    paymentIntentId: deposit.id,
    expectedRefundCents: 10000,
  },
});
assert.equal(remaining.pending, false);
const charge = await stripe.charges.retrieve(deposit.chargeId);
assert.equal(charge.amount_refunded, 30000);
assert.equal(charge.livemode, false);
console.log('PASS: Stripe test-mode brand customer/card, $300 deposit, $100 unused-slot refund, $200 remaining refund; no test balance left on this charge.');
console.log(`Test PaymentIntent: ${deposit.id}`);
console.log(`Test charge: ${deposit.chargeId}`);
