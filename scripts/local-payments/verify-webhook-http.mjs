// Signed HTTP webhook and replay check against a disposable local Thesi API.
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
assert.match(env.STRIPE_WEBHOOK_SECRET ?? '', /^whsec_/);
const stripe = new Stripe(env.STRIPE_SECRET_KEY);
const url = 'http://127.0.0.1:5011/v1/stripe/webhooks';
const eventId = `evt_thesi_local_${randomUUID().replaceAll('-', '')}`;
const payload = JSON.stringify({
  id: eventId,
  object: 'event',
  type: 'account.updated',
  api_version: '2024-01-01',
  created: Math.floor(Date.now() / 1000),
  livemode: false,
  data: { object: { id: 'acct_1UOKmnRvQSJSpIsZ', object: 'account' } },
});
const signature = stripe.webhooks.generateTestHeaderString({
  payload,
  secret: env.STRIPE_WEBHOOK_SECRET,
});

async function post(body, header) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(header ? { 'stripe-signature': header } : {}),
    },
    body,
  });
  return { status: response.status, body: await response.json() };
}

const first = await post(payload, signature);
assert.equal(first.status, 200);
assert.equal(first.body.data.action, 'account.updated_logged');
const replay = await post(payload, signature);
assert.equal(replay.status, 200);
assert.equal(replay.body.data.duplicate, true);
const tampered = await post(payload.replace('account.updated', 'account.deleted'), signature);
assert.equal(tampered.status, 400);
const unsigned = await post(payload);
assert.equal(unsigned.status, 400);
console.log(`PASS: signed HTTP event ${eventId}, duplicate replay, tampered body rejection, unsigned request rejection.`);
