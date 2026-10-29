// Reversible Stripe test-mode probe of FundingGateway's transfer path.
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
const stripe = new Stripe(env.STRIPE_SECRET_KEY, { timeout: 15000, maxNetworkRetries: 0 });
assert.equal((await stripe.accounts.retrieve()).id, env.STRIPE_PLATFORM_ACCOUNT_ID);
const accounts = await stripe.accounts.list({ limit: 100 });
assert.equal(accounts.has_more, false);
const destination = accounts.data.find(
  (account) => account.type === 'express' && account.payouts_enabled &&
    account.details_submitted && account.capabilities?.transfers === 'active' &&
    (!process.env.STRIPE_TEST_DESTINATION_ACCOUNT_ID ||
      account.id === process.env.STRIPE_TEST_DESTINATION_ACCOUNT_ID),
);
assert.ok(destination, 'A ready test Express account is required');
if (process.env.STRIPE_TEST_DESTINATION_ACCOUNT_ID) {
  assert.equal(destination.metadata?.channel, 'thesi-creator');
}
const gateway = new FundingGateway({
  get: (key) => key === 'CAMPAIGN_FUNDING_ENABLED' ? true : env[key],
  getOrThrow: (key) => {
    if (!env[key]) throw new Error(`${key} missing`);
    return env[key];
  },
});
const runId = randomUUID();
const customer = await stripe.customers.create({
  email: `thesi-transfer-probe-${runId}@example.test`,
  metadata: { purpose: 'thesi_transfer_probe', runId },
});
const card = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } });
await stripe.paymentMethods.attach(card.id, { customer: customer.id });
const campaignId = randomUUID();
const deposit = await gateway.execute({
  id: randomUUID(), campaign_id: campaignId, kind: 'deposit', amount_cents: 10000,
  args: { customerId: customer.id, paymentMethodId: card.id },
});
assert.ok(deposit.chargeId);
const release = await gateway.execute({
  id: randomUUID(), campaign_id: campaignId, obligation_id: randomUUID(),
  kind: 'release', amount_cents: 10000,
  args: { chargeId: deposit.chargeId, destination: destination.id, expectedRefundCents: 0 },
});
const transfer = await stripe.transfers.retrieve(release.id);
assert.equal(transfer.destination, destination.id);
assert.equal(transfer.amount, 10000);
assert.equal(transfer.source_transaction, deposit.chargeId);
const reversal = await stripe.transfers.createReversal(release.id, { amount: 10000 });
assert.equal(reversal.amount, 10000);
const refund = await gateway.execute({
  id: randomUUID(), campaign_id: campaignId, kind: 'refund_cancelled', amount_cents: 10000,
  args: { chargeId: deposit.chargeId, paymentIntentId: deposit.id, expectedRefundCents: 0 },
});
assert.equal(refund.pending, false);
assert.equal((await stripe.charges.retrieve(deposit.chargeId)).amount_refunded, 10000);
console.log(`PASS: Stripe test charge, $100 source-transaction transfer to ${destination.id}, full transfer reversal, and full charge refund.`);
console.log(`Test PaymentIntent: ${deposit.id}`);
console.log(`Test transfer: ${release.id}`);
