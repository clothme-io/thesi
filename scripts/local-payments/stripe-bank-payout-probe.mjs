// Test-only Connect bank payout using available platform test balance.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'thesi-api/package.json'));
const Stripe = require('stripe');
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

const accountId = process.env.STRIPE_TEST_DESTINATION_ACCOUNT_ID;
assert.match(accountId ?? '', /^acct_/);
const account = await stripe.accounts.retrieve(accountId);
assert.equal(account.type, 'express');
assert.equal(account.metadata?.channel, 'thesi-creator');
assert.equal(account.details_submitted, true);
assert.equal(account.payouts_enabled, true);
assert.equal(account.capabilities?.transfers, 'active');

const banks = await stripe.accounts.listExternalAccounts(accountId, { object: 'bank_account', limit: 10 });
const bank = banks.data.find((item) => item.currency === 'cad' && item.country === 'CA');
assert.ok(bank, 'Canadian test bank required');

const transferAmount = 1000;
const payoutAmount = 500;
const platformBalance = await stripe.balance.retrieve();
const availableCad = platformBalance.available.find((item) => item.currency === 'cad')?.amount ?? 0;
assert.ok(availableCad >= transferAmount, 'Available CAD test balance required');

const runId = randomUUID();
const transfer = await stripe.transfers.create({
  amount: transferAmount,
  currency: 'cad',
  destination: accountId,
  metadata: { purpose: 'thesi_test_bank_payout_probe', runId },
}, { idempotencyKey: `${runId}:transfer` });
assert.equal(transfer.livemode, false);
assert.equal(transfer.destination, accountId);
console.log(`Test transfer: ${transfer.id}`);

const connectedBalance = await stripe.balance.retrieve({}, { stripeAccount: accountId });
const connectedCad = connectedBalance.available.find((item) => item.currency === 'cad')?.amount ?? 0;
assert.ok(connectedCad >= payoutAmount, 'Connected test CAD balance did not become available');

const payout = await stripe.payouts.create({
  amount: payoutAmount,
  currency: 'cad',
  destination: bank.id,
  source_type: 'card',
  metadata: { purpose: 'thesi_test_bank_payout_probe', runId, transferId: transfer.id },
}, { stripeAccount: accountId, idempotencyKey: `${runId}:payout` });
assert.equal(payout.livemode, false);
assert.equal(payout.destination, bank.id);
assert.equal(payout.amount, payoutAmount);
console.log(`Test bank payout: ${payout.id} (${payout.status})`);
