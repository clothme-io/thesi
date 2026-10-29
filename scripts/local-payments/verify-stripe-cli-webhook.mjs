// Forward a real Stripe test event through Stripe CLI to a disposable local API/DB.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'thesi-api/package.json'));
const { Pool } = require('pg');
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
const databaseUrl = 'postgresql://demo:demo-local-only@127.0.0.1:5844/thesi_demo';
const eventTypes = (process.env.STRIPE_TEST_WEBHOOK_EVENTS || 'account.updated')
  .split(',').map((type) => type.trim()).filter(Boolean);
const pool = new Pool({ connectionString: databaseUrl });
const cliEnv = { ...process.env, STRIPE_API_KEY: env.STRIPE_SECRET_KEY };
const clean = (value) => value.replace(/(?:whsec_|sk_test_)[A-Za-z0-9]+/g, '[redacted]');
const waitUntil = async (condition, label, getLog) => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${label} timed out: ${clean(getLog().slice(-600))}`);
};

let listener;
let api;
try {
  const before = new Set((await pool.query('SELECT id FROM thesi.stripe_webhook_event WHERE type = ANY($1::text[])', [eventTypes])).rows.map((r) => r.id));
  let listenerLog = '';
  let secret;
  listener = spawn('stripe', [
    'listen', '--skip-update', '--events', eventTypes.join(','),
    '--forward-to', 'http://127.0.0.1:5012/v1/stripe/webhooks',
  ], { env: cliEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  const onListenerOutput = (chunk) => {
    listenerLog += chunk.toString();
    secret ??= listenerLog.match(/whsec_[A-Za-z0-9]+/)?.[0];
  };
  listener.stdout.on('data', onListenerOutput);
  listener.stderr.on('data', onListenerOutput);
  await waitUntil(() => Boolean(secret) || listener.exitCode !== null, 'Stripe CLI listener', () => listenerLog);
  assert.ok(secret, `Stripe CLI listener failed: ${clean(listenerLog.slice(-600))}`);

  let apiLog = '';
  api = spawn('node', ['dist/main.js'], {
    cwd: path.join(root, 'thesi-api'),
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      PORT: '5012',
      NODE_ENV: 'development',
      STRIPE_WEBHOOK_SECRET: secret,
      COMMISSION_EARNINGS_ENABLED: 'false',
      CAMPAIGN_FUNDING_ENABLED: 'false',
      COMMISSION_SETTLEMENT_ENABLED: 'false',
      MERCHANT_LINKING_ENABLED: 'false',
      MERCHANT_SSO_ENABLED: 'false',
      CREATOR_TRACKING_ENABLED: 'false',
      CREATOR_LINKS_ENABLED: 'false',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  api.stdout.on('data', (chunk) => { apiLog += chunk.toString(); });
  api.stderr.on('data', (chunk) => { apiLog += chunk.toString(); });
  await waitUntil(() => apiLog.includes('Thesi API running on port 5012') || api.exitCode !== null, 'local API', () => apiLog);
  assert.ok(apiLog.includes('Thesi API running on port 5012'), `Local API failed: ${clean(apiLog.slice(-600))}`);

  for (const type of eventTypes) {
    const transferReversal = type === 'transfer.reversed';
    const trigger = transferReversal
      ? spawn('node', ['scripts/local-payments/stripe-transfer-probe.mjs'], {
        cwd: root,
        env: { ...process.env, STRIPE_TEST_DESTINATION_ACCOUNT_ID: 'acct_1UOKmnRvQSJSpIsZ' },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      : spawn('stripe', ['trigger', type], { env: cliEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    let triggerLog = '';
    trigger.stdout.on('data', (chunk) => { triggerLog += chunk.toString(); });
    trigger.stderr.on('data', (chunk) => { triggerLog += chunk.toString(); });
    await waitUntil(() => trigger.exitCode !== null, `Stripe ${type} trigger`, () => triggerLog);
    assert.equal(trigger.exitCode, 0, `Stripe ${type} trigger failed: ${clean(triggerLog.slice(-600))}`);
  }

  let delivered = [];
  await waitUntil(async () => {
    const rows = (await pool.query('SELECT id,type FROM thesi.stripe_webhook_event WHERE type = ANY($1::text[])', [eventTypes])).rows;
    delivered = rows.filter((row) => !before.has(row.id));
    return eventTypes.every((type) => delivered.some((row) => row.type === type)) &&
      (listenerLog.match(/\[200\]/g)?.length ?? 0) >= eventTypes.length;
  }, 'Stripe webhook delivery', () => listenerLog + apiLog);
  // The listener's HTTP 200 and database event are both required.
  console.log(`PASS: Stripe CLI forwarded ${eventTypes.join(', ')} to local Thesi API; HTTP 200; persisted ${delivered.map((row) => `${row.type}:${row.id}`).join(', ')}.`);
} finally {
  api?.kill('SIGTERM');
  listener?.kill('SIGTERM');
  await pool.end();
}
