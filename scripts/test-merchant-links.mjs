// Disposable embedded PostgreSQL test. Pass an installed PGlite module path.
// No network, credentials, persistent database or production connection is used.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { audit, ownership } from './audit-brand-workspaces.mjs';

if (!process.argv[2]) throw new Error('Pass the path to an installed @electric-sql/pglite module');
const { PGlite } = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const db = new PGlite();
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migrations = path.resolve(root, '../clothme-db/databases/thesi/sql');
const files = (await readdir(migrations)).filter(f => /^V\d+__.*\.sql$/.test(f))
  .sort((a, b) => Number(a.match(/^V(\d+)/)[1]) - Number(b.match(/^V(\d+)/)[1]));
const query = async (text, params = []) => (await db.query(text, params)).rows;
async function migrate(file) {
  let sql = await readFile(path.join(migrations, file), 'utf8');
  // PGlite has built-in gen_random_uuid but does not ship pgcrypto. This is the
  // sole adaptation; all domain SQL and PL/pgSQL execute unchanged.
  sql = sql.replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;', '');
  await db.exec('BEGIN');
  try { await db.exec(sql); await db.exec('COMMIT'); }
  catch (e) { await db.exec('ROLLBACK'); throw new Error(`${file}: ${e.message}`); }
}
async function user(id, role = 'brand') {
  await query(`INSERT INTO public.thesi_users(id,email,password_hash,full_name,role)
    VALUES ($1,$2,'fixture','Fixture',$3)`, [id, `${id}@example.test`, role]);
}
async function campaign(owner, workspace) {
  return (await query(`INSERT INTO thesi.campaign(owner_user_id,name,campaign_type,status,start_date,end_date${workspace ? ',workspace_id' : ''})
    VALUES ($1,'Fixture','experience','draft','2026-01-01','2026-12-31'${workspace ? ',$2' : ''}) RETURNING *`, workspace ? [owner,workspace] : [owner]))[0];
}
try {
  for (const file of files.filter(f => Number(f.match(/^V(\d+)/)[1]) < 33)) await migrate(file);
  await user('owner'); await user('other'); await user('creator', 'creator');
  await migrate(files.find(f => f.startsWith('V33__')));
  await query('SELECT * FROM thesi.backfill_brand_workspaces(100)');
  await migrate(files.find(f => f.startsWith('V34__')));
  await migrate(files.find(f => f.startsWith('V35__')));
  const require = createRequire(path.join(root, 'thesi-api/package.json'));
  require('reflect-metadata');
  const Module = require('node:module'); const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function(request, ...rest) {
    if (request === '@electric-sql/pglite') return path.join(path.dirname(path.resolve(process.argv[2])), 'index.cjs');
    return originalResolve.call(this, request.startsWith('src/') ? path.join(root, 'thesi-api/dist', request.slice(4)) : request, ...rest);
  };
  const { drizzle } = require('drizzle-orm/pglite');
  const database = drizzle(db);
  const { MerchantLinksService, digest } = require(path.join(root, 'thesi-api/dist/api/merchant-links/merchant-links.service.js'));
  const { BrandWorkspacesService } = require(path.join(root, 'thesi-api/dist/api/brand-workspaces/brand-workspaces.service.js'));
  const links = new MerchantLinksService(database, { get: key => key !== 'MERCHANT_SSO_ENABLED', getOrThrow: key => key === 'THESI_WEB_URL' ? 'https://thesi.example.test' : 'https://merchant.example.test' });
  const workspaces = new BrandWorkspacesService(database, { get: () => true });
  await links.onApplicationBootstrap();
  const workspace = (await workspaces.resolveLegacyAccess('owner')).workspaceId;
  const second = (await workspaces.create('owner', 'Second Brand', '10000000-0000-4000-8000-000000000001')).id;
  const vendorId = '20000000-0000-4000-8000-000000000001';
  const brandId = '30000000-0000-4000-8000-000000000001';
  const otherBrand = '30000000-0000-4000-8000-000000000002';
  const otherVendor = '20000000-0000-4000-8000-000000000002';
  const verifier = 'v'.repeat(43); const state = 's'.repeat(43);
  const input = { vendorId, brandId, vendorName: 'Merchant owner', brandName: 'Merchant brand', state, challenge: digest(verifier), action: 'link' };
  const codeFrom = url => new URLSearchParams(new URL(url).hash.slice(1)).get('code');
  const start = await links.start(input); const code = codeFrom(start.url);
  assert.equal(new URL(start.url).pathname, '/merchant-link');
  assert.equal(new URL(start.url).search, '');
  assert.equal((await links.describe(code)).brandName, input.brandName);
  await assert.rejects(links.approve('other', code, workspace), /Thesi brand owner/);
  await assert.rejects(links.approve('creator', code, workspace), /Thesi brand owner/);
  assert.equal((await links.status(vendorId, brandId)).link, null);
  const approved = await links.approve('owner', code, workspace);
  const grant = codeFrom(approved.url);
  assert.equal(new URL(approved.url).origin, 'https://merchant.example.test');
  assert.equal(new URLSearchParams(new URL(approved.url).hash.slice(1)).get('state'), state);
  await assert.rejects(links.approve('owner', code, workspace), /already been used/);
  const exchange = { vendorId, brandId, code: grant, verifier };
  await assert.rejects(links.review({ ...exchange, verifier: 'wrong'.repeat(9) }), /verification failed/);
  await assert.rejects(links.complete({ ...exchange, vendorId: otherVendor }), /verification failed/);
  await assert.rejects(links.complete({ ...exchange, brandId: otherBrand }), /verification failed/);
  assert.equal((await links.status(vendorId, brandId)).link, null, 'approval alone never links accounts');
  const review = await links.review(exchange);
  assert.equal(review.accountEmail, 'owner@example.test');
  const linked = await links.complete(exchange);
  assert.deepEqual(await links.complete(exchange), linked, 'lost final response may be retried idempotently');
  assert.equal((await links.status(vendorId, brandId)).link.id, linked.id);
  assert.equal((await links.status(otherVendor, brandId)).link, null);
  assert.equal((await links.mine('owner')).length, 1);
  assert.deepEqual(await links.mine('other'), []);
  await assert.rejects(links.start(input), /already connected/);

  const nextStart = await links.start({ ...input, brandId: otherBrand });
  await assert.rejects(links.approve('owner', codeFrom(nextStart.url), workspace), /already connected/);
  const nextGrant = codeFrom((await links.approve('owner', codeFrom(nextStart.url), second)).url);
  const nextLink = await links.complete({ ...exchange, brandId: otherBrand, code: nextGrant });
  assert.equal((await links.mine('owner')).length, 2, 'one vendor may connect multiple brands under the same Thesi account');

  const launch = await links.start({ ...input, action: 'open' });
  await assert.rejects(links.approve('other', codeFrom(launch.url)), /connected to this Merchant brand/);
  assert.deepEqual(await links.approve('owner', codeFrom(launch.url)), { workspaceId: workspace });
  await assert.rejects(links.approve('owner', codeFrom(launch.url)), /already been used/);
  const revokedLaunch = await links.start({ ...input, action: 'open' });
  await assert.rejects(links.revoke(linked.id, { vendorId: otherVendor, brandId }), /not found/);
  await assert.rejects(links.revoke(linked.id, { userId: 'other' }), /not found/);
  await links.revoke(linked.id, { vendorId, brandId });
  await links.revoke(linked.id, { vendorId, brandId });
  await assert.rejects(links.approve('owner', codeFrom(revokedLaunch.url)), /expired|unavailable/);
  await assert.rejects(links.complete(exchange), /no longer active/);
  assert.equal((await links.status(vendorId, brandId)).link, null);
  assert.equal((await links.status(vendorId, otherBrand)).link.id, nextLink.id);
  await links.revoke(nextLink.id, { userId: 'owner' });

  // Both owners may approve before either completion commits. The database
  // unique boundary still allows only one active mapping; a losing transaction
  // must not leave a misleading linked audit event.
  const competingA = codeFrom((await links.start(input)).url);
  const competingB = codeFrom((await links.start({ ...input, brandId: otherBrand })).url);
  const grantA = codeFrom((await links.approve('owner', competingA, workspace)).url);
  const grantB = codeFrom((await links.approve('owner', competingB, workspace)).url);
  const winner = await links.complete({ ...exchange, code: grantA });
  await assert.rejects(links.complete({ ...exchange, brandId: otherBrand, code: grantB }), /already connected/);
  assert.equal((await links.status(vendorId, otherBrand)).link, null);
  await links.revoke(winner.id, { userId: 'owner' });
  await assert.rejects(links.complete({ ...exchange, brandId: otherBrand, code: grantB }), /expired/);

  const revokedOwner = await links.start(input); const revokedGrant = codeFrom((await links.approve('owner', codeFrom(revokedOwner.url), workspace)).url);
  await query(`UPDATE thesi.brand_workspace_member SET status='revoked' WHERE workspace_id=$1`, [workspace]);
  await assert.rejects(links.complete({ ...exchange, code: revokedGrant }), /Thesi brand owner/);
  await query(`UPDATE thesi.brand_workspace_member SET status='active' WHERE workspace_id=$1`, [workspace]);
  await query(`UPDATE thesi.brand_workspace SET status='archived' WHERE id=$1`, [workspace]);
  await assert.rejects(links.review({ ...exchange, code: revokedGrant }), /Thesi brand owner/);
  await query(`UPDATE thesi.brand_workspace SET status='active' WHERE id=$1`, [workspace]);
  await query(`UPDATE thesi.merchant_link_intent SET expires_at=now()-interval '1 second' WHERE grant_hash=$1`, [digest(revokedGrant)]);
  await assert.rejects(links.complete({ ...exchange, code: revokedGrant }), /expired/);
  const eventKinds = (await query('SELECT DISTINCT event FROM thesi.merchant_link_event')).map(row => row.event).sort();
  assert.deepEqual(eventKinds, ['approved','linked','opened','revoked','started']);
  assert.equal((await query(`SELECT count(*)::int AS n FROM thesi.merchant_link_event WHERE link_id=$1 AND event='revoked'`, [linked.id]))[0].n, 1);
  const stored = await query('SELECT token_hash,grant_hash,challenge FROM thesi.merchant_link_intent');
  assert(stored.every(row => row.token_hash !== code && row.grant_hash !== grant && row.challenge !== verifier));
  console.log('PASS: V35 link handshake; explicit two-sided consent; wrong-user/vendor/brand/verifier rejection; two-brand mapping; hashed codes; one-time authorization/open; idempotent completion; expiry; revoked membership/workspaces; unlink from either platform; invalidation and audit events');
} finally { await db.close(); }
