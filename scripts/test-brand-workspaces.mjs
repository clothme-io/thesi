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
  await user('existing'); await user('other'); await user('creator', 'creator');
  const before = await campaign('existing');
  await query(`INSERT INTO thesi.brand_profile(user_id,company_name) VALUES ('existing','Existing Brand')`);
  await query(`INSERT INTO thesi.inbox_thread(brand_user_id,creator_user_id) VALUES ('existing','creator')`);
  await query(`INSERT INTO thesi.brand_creator_favorite(brand_user_id,creator_user_id) VALUES ('existing','creator')`);
  await query(`INSERT INTO thesi.campaign_file(campaign_id,owner_user_id,original_name,size_bytes,content_type,storage_provider,storage_key)
    VALUES ($1,'existing','fixture.txt',10,'text/plain','local','fixture')`,[before.id]);
  await query(`INSERT INTO thesi.marketplace_listing(campaign_id,owner_user_id,brand_name,name,campaign_type,status,start_date,end_date,application_deadline)
    VALUES ($1,'existing','Brand','Listing','experience','open','2026-01-01','2026-12-31','2026-12-01')`,[before.id]);
  await query(`INSERT INTO thesi.campaign_invite(campaign_id,brand_user_id,campaign_name,brand_name,creator_user_id,creator_email,creator_name)
    VALUES ($1,'existing','Campaign','Brand','creator','creator@example.test','Creator')`,[before.id]);
  await query(`INSERT INTO thesi.campaign_platform_fee(campaign_id,brand_user_id,payout_cents,fee_cents,status,idempotency_key)
    VALUES ($1,'existing',10000,200,'paid','fee-fixture')`,[before.id]);
  await query(`INSERT INTO thesi.creator_payout(campaign_id,brand_user_id,creator_user_id,amount_cents,status,stripe_destination_account_id,idempotency_key)
    VALUES ($1,'existing','creator',10000,'transferred','acct_fixture','payout-fixture')`,[before.id]);
  await query(`INSERT INTO thesi.campaign_acceptance_snapshot(campaign_id,brand_user_id,creator_user_id,creator_email,creator_name,source,source_id,
    campaign_name,campaign_type,content_types,start_date,end_date,brief,deliverables,payment_snapshot,creator_benefits_snapshot,products_provided_snapshot,content_rights_snapshot,required_tasks_snapshot)
    VALUES ($1,'existing','creator','creator@example.test','Creator','campaign_invite','fixture','Campaign','experience','[]','2026-01-01','2026-12-31','','',
    '{"model":"commission","hybrid":{"base":{"amountCents":10000}}}','{}','[]','{}','[]')`,[before.id]);
  const snapshots = new Map();
  for (const table of Object.keys(ownership)) snapshots.set(table, await query(`SELECT * FROM thesi.${table}`));
  assert.equal((await audit(db)).foundationInstalled, false);
  await query(`INSERT INTO thesi.creator_profile(user_id,display_name) VALUES ('creator','Creator')`);
  await migrate(files.find(f => f.startsWith('V33__')));
  assert.equal((await query('SELECT workspace_id FROM thesi.campaign WHERE id=$1',[before.id]))[0].workspace_id, null);
  const first = await query('SELECT * FROM thesi.backfill_brand_workspaces(1)');
  assert(first.every(row => row.affected <= 1));
  await query('SELECT * FROM thesi.backfill_brand_workspaces(100)');
  assert((await query('SELECT * FROM thesi.backfill_brand_workspaces(100)')).every(row => row.affected === 0));
  assert.equal((await query('SELECT count(*)::int AS n FROM thesi.brand_workspace'))[0].n, 2);
  const existing = (await query(`SELECT * FROM thesi.brand_workspace WHERE legacy_owner_user_id='existing'`))[0];
  assert.equal(existing.name, 'Existing Brand');
  for (const [table, originalRows] of snapshots) {
    const rows = await query(`SELECT * FROM thesi.${table}`);
    assert(rows.every(row => row.workspace_id === existing.id), table);
    assert.deepEqual(rows.map(({ workspace_id, ...row }) => row), originalRows, `${table}: historical fields preserved`);
  }
  const other = (await query(`SELECT * FROM thesi.brand_workspace WHERE legacy_owner_user_id='other'`))[0];
  const after = (await query('SELECT * FROM thesi.campaign WHERE id=$1',[before.id]))[0];
  const { workspace_id, ...oldFields } = after;
  assert.equal(workspace_id, existing.id); assert.deepEqual(oldFields, before);
  assert.equal((await campaign('existing')).workspace_id, existing.id);
  await user('new');
  assert.equal((await query(`SELECT count(*)::int AS n FROM thesi.brand_workspace WHERE legacy_owner_user_id='new'`))[0].n, 1);
  assert((await campaign('new')).workspace_id);
  await assert.rejects(campaign('existing', other.id), /Non-default workspace/);
  await assert.rejects(query('SELECT thesi.ensure_legacy_brand_workspace($1)', ['creator']), /brand account/);
  await assert.rejects(query('SELECT * FROM thesi.backfill_brand_workspaces(0)'), /Batch size/);
  await query(`UPDATE thesi.brand_workspace_member SET status='revoked' WHERE user_id='other'`);
  await query(`SELECT thesi.ensure_legacy_brand_workspace('other')`);
  assert.equal((await query(`SELECT status FROM thesi.brand_workspace_member WHERE user_id='other'`))[0].status, 'revoked');
  assert.equal((await query('SELECT count(*)::int AS n FROM thesi.creator_profile'))[0].n, 1);
  const inventory = await audit(db);
  assert.equal(inventory.foundationInstalled, true);
  assert(inventory.ownership.every(row => row.invalid_owner === 0 && row.missing_workspace === 0 && row.conflicting_workspace === 0));
  assert.equal(inventory.missingOwnerMemberships, 1);

  // Exercise the actual compiled service and Drizzle predicates against SQL,
  // including unauthorized users, revoked membership and archived workspaces.
  const require = createRequire(path.join(root, 'thesi-api/package.json'));
  require('reflect-metadata');
  const Module = require('node:module');
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function(request, ...rest) {
    if (request === '@electric-sql/pglite') return path.join(path.dirname(path.resolve(process.argv[2])), 'index.cjs');
    return originalResolve.call(this, request.startsWith('src/')
      ? path.join(root, 'thesi-api/dist', request.slice(4)) : request, ...rest);
  };
  const { drizzle } = require('drizzle-orm/pglite');
  const { BrandWorkspacesService } = require(path.join(root, 'thesi-api/dist/api/brand-workspaces/brand-workspaces.service.js'));
  const service = new BrandWorkspacesService(drizzle(db), { get: key => key === 'BRAND_WORKSPACES_ENABLED' });
  assert.deepEqual((await service.list('existing')).map(w => w.id), [existing.id]);
  assert.deepEqual(await service.list('other'), []);
  assert.deepEqual(await service.list('stranger'), []);
  const access = await service.resolveLegacyAccess('existing');
  assert.equal(access.workspaceId, existing.id);
  assert.equal(access.actorUserId, 'existing');
  await assert.rejects(service.resolveLegacyAccess('existing', other.id), /not available/);
  await assert.rejects(service.resolveLegacyAccess('other'), /not available/);

  const { workspaceContext } = require(path.join(root, 'thesi-api/dist/api/brand-workspaces/workspace-context.js'));
  const repository = (area, file, name) => new (require(path.join(root, `thesi-api/dist/api/${area}/${file}.js`))[name])(drizzle(db));
  const campaigns = repository('campaigns', 'postgres-campaign.repository', 'PostgresCampaignRepository');
  const profiles = repository('profiles', 'postgres-profile.repository', 'PostgresProfileRepository');
  const inbox = repository('inbox', 'postgres-inbox.repository', 'PostgresInboxRepository');
  const marketplace = repository('marketplace', 'postgres-marketplace.repository', 'PostgresMarketplaceRepository');
  const favorites = repository('creators', 'postgres-creators-directory.repository', 'PostgresCreatorsDirectoryRepository');
  const threadId = (await query(`SELECT id FROM thesi.inbox_thread WHERE brand_user_id='existing'`))[0].id;
  const message = (await query(`INSERT INTO thesi.inbox_message(thread_id,sender_user_id,subject,content) VALUES ($1,'creator','Subject','Body') RETURNING id`, [threadId]))[0];
  await query(`INSERT INTO thesi.inbox_message_state(message_id,user_id,read,deleted) VALUES ($1,'existing',false,false)`, [message.id]);
  const notification = (await query(`INSERT INTO thesi.inbox_notification(user_id,type,title,body,campaign_id,audience) VALUES ('existing','campaign_invite','Fixture','Body',$1,'brand') RETURNING id`,[before.id]))[0];
  await workspaceContext.run(access, async () => {
    assert((await campaigns.getByIdForOwner('existing', before.id)));
    assert.equal((await profiles.getBrandProfile('existing')).companyName, 'Existing Brand');
    assert.equal((await inbox.listMessagesForUser('existing')).length, 1);
    assert.equal((await campaigns.listCreatorPayoutsForCampaign(before.id)).length, 1);
    assert.equal((await marketplace.listByOwner('existing')).length, 1);
  });
  // Disposable adversarial fixture: move rows into another workspace while
  // retaining the same legacy owner. This proves predicates use workspace_id,
  // rather than passing isolation tests only because user IDs differ.
  for (const [table, owner] of Object.entries(ownership)) {
    await db.exec(`ALTER TABLE thesi.${table} DISABLE TRIGGER assign_legacy_workspace`);
    await query(`UPDATE thesi.${table} SET workspace_id=$1 WHERE ${owner}='existing'`, [other.id]);
    await db.exec(`ALTER TABLE thesi.${table} ENABLE TRIGGER assign_legacy_workspace`);
  }
  await workspaceContext.run(access, async () => {
    assert.deepEqual(await campaigns.listByOwner('existing'), []);
    assert.equal(await campaigns.getByIdForOwner('existing', before.id), null);
    assert.deepEqual(await campaigns.listFiles(before.id), []);
    assert.equal(await campaigns.getPlatformFee(before.id), null);
    assert.deepEqual(await campaigns.listCreatorPayoutsForCampaign(before.id), []);
    assert.equal(await profiles.getBrandProfile('existing'), null);
    assert.deepEqual(await marketplace.listByOwner('existing'), []);
    assert.deepEqual(await marketplace.listAll(), []);
    assert.deepEqual(await favorites.listFavoriteIds('existing'), []);
    assert.deepEqual(await inbox.listThreadsForUser('existing'), []);
    assert.deepEqual(await inbox.listMessagesForUser('existing'), []);
    assert.equal(await inbox.getThreadForUser('existing', threadId), null);
    assert.equal(await inbox.softDeleteMessage('existing', message.id), false);
    await inbox.markThreadRead('existing', threadId);
    assert.deepEqual(await inbox.listNotifications('existing'), []);
    assert.equal(await inbox.markNotificationRead('existing', notification.id), false);
    await inbox.markAllNotificationsRead('existing');
  });
  assert.equal((await query(`SELECT read FROM thesi.inbox_message_state WHERE message_id=$1`, [message.id]))[0].read, false);
  assert.equal((await query(`SELECT read FROM thesi.inbox_notification WHERE id=$1`, [notification.id]))[0].read, false);
  // Without brand context, creators retain their own cross-brand view.
  assert.equal((await inbox.listThreadsForUser('creator')).length, 1);
  await query('UPDATE thesi.brand_workspace SET status=$1 WHERE id=$2', ['archived', existing.id]);
  assert.deepEqual(await service.list('existing'), []);
  await assert.rejects(service.resolveLegacyAccess('existing'), /not available/);
  console.log('PASS: migration/backfill preservation; request resolution; campaign/profile/file/fee/payout/marketplace/favorite/inbox isolation with identical legacy owner IDs; read/delete protection; revoked/archived access; creator preservation');
} finally { await db.close(); }
