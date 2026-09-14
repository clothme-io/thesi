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
  await query(`INSERT INTO thesi.brand_profile(user_id,company_name) VALUES ('owner','Original Brand')`);
  const original = await campaign('owner');
  await migrate(files.find(f => f.startsWith('V33__')));
  await assert.rejects(migrate(files.find(f => f.startsWith('V34__'))), /backfill/);
  await query('SELECT * FROM thesi.backfill_brand_workspaces(100)');
  await migrate(files.find(f => f.startsWith('V34__')));

  const require = createRequire(path.join(root, 'thesi-api/package.json'));
  require('reflect-metadata');
  const Module = require('node:module');
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function(request, ...rest) {
    if (request === '@electric-sql/pglite') return path.join(path.dirname(path.resolve(process.argv[2])), 'index.cjs');
    return originalResolve.call(this, request.startsWith('src/') ? path.join(root, 'thesi-api/dist', request.slice(4)) : request, ...rest);
  };
  const { drizzle } = require('drizzle-orm/pglite');
  const database = drizzle(db);
  const { BrandWorkspacesService } = require(path.join(root, 'thesi-api/dist/api/brand-workspaces/brand-workspaces.service.js'));
  const service = new BrandWorkspacesService(database, { get: () => true });
  await service.onApplicationBootstrap();
  const first = await service.resolveLegacyAccess('owner');
  const creationKey = '10000000-0000-4000-8000-000000000001';
  const second = await service.create('owner', 'Second Brand', creationKey);
  assert.deepEqual(await service.create('owner', 'Second Brand', creationKey), second);
  await assert.rejects(service.create('owner', 'Different name', creationKey), /already been used/);
  await assert.rejects(service.create('creator', 'Unauthorized', creationKey), /not available/);
  assert.equal((await service.list('owner')).length, 2);
  assert.equal((await service.list('other')).length, 1);
  const secondAccess = await service.resolveLegacyAccess('owner', second.id);
  assert.equal(secondAccess.isDefault, false);
  assert.equal(secondAccess.name, 'Second Brand');
  await assert.rejects(service.resolveLegacyAccess('other', second.id), /not available/);
  const paused = new BrandWorkspacesService(database, { get: key => key !== 'MULTI_BRAND_ENABLED' });
  await paused.onApplicationBootstrap();
  assert.equal((await paused.resolveLegacyAccess('owner', second.id)).workspaceId, second.id);
  await assert.rejects(paused.create('owner', 'Paused', creationKey), /Not found/);
  assert((await paused.list('owner')).every(row => !row.canCreate));
  await assert.rejects(new BrandWorkspacesService(database, { get: () => false }).onApplicationBootstrap(), /cannot be disabled/);

  const { workspaceContext } = require(path.join(root, 'thesi-api/dist/api/brand-workspaces/workspace-context.js'));
  const repository = (area, file, name) => new (require(path.join(root, `thesi-api/dist/api/${area}/${file}.js`))[name])(database);
  const campaigns = repository('campaigns', 'postgres-campaign.repository', 'PostgresCampaignRepository');
  const profiles = repository('profiles', 'postgres-profile.repository', 'PostgresProfileRepository');
  const inbox = repository('inbox', 'postgres-inbox.repository', 'PostgresInboxRepository');
  const marketplace = repository('marketplace', 'postgres-marketplace.repository', 'PostgresMarketplaceRepository');
  const favorites = repository('creators', 'postgres-creators-directory.repository', 'PostgresCreatorsDirectoryRepository');
  const input = { name: 'Second campaign', campaignType: 'experience', contentTypes: [], status: 'draft', startDate: '2026-01-01', endDate: '2026-12-31', brief: '', deliverables: '', requirements: {}, payment: { model: 'commission', hybrid: { base: { amountCents: 10000, currency: 'USD' }, affiliate: { commissionPercent: 10 } } }, requiredTasks: [], creatorBenefits: {}, contentRights: {}, productsProvided: [], postToMarketplace: false };
  let secondaryCampaign, secondThread, firstThread;
  await workspaceContext.run(secondAccess, async () => {
    secondaryCampaign = await campaigns.create('owner', input);
    assert.deepEqual((await campaigns.listByOwner('owner')).map(c => c.id), [secondaryCampaign.id]);
    assert.equal(await campaigns.getByIdForOwner('owner', original.id), null);
    assert.equal(await campaigns.update('owner', original.id, input), null);
    const profile = await profiles.getBrandProfile('owner');
    assert.equal(profile.companyName, 'Second Brand');
    await profiles.upsertBrandProfile('owner', { ...profile, companyName: 'Second Brand Updated' });
    assert.equal((await profiles.getBrandProfile('owner')).companyName, 'Second Brand Updated');
    await profiles.setBrandLogo('owner', { logoUrl: '/secondary-logo', storageKey: 'secondary', storageProvider: 'local', contentType: 'image/png' });
    assert.equal((await profiles.getBrandLogo('owner')).storageKey, 'secondary');
    await favorites.addFavorite('owner', 'creator');
    secondThread = await inbox.ensureThread('owner', 'creator', secondaryCampaign.id);
    await inbox.createMessage({ threadId: secondThread.id, senderUserId: 'owner', recipientUserId: 'creator', subject: 'Second', content: 'Second brand message', campaignId: secondaryCampaign.id });
    assert.equal((await inbox.listThreadsForUser('owner')).length, 1);
    assert.equal((await inbox.listMessagesForUser('owner')).length, 1);
    assert.equal(await marketplace.getBrandDisplayName('owner'), 'Second Brand Updated');
    await campaigns.createFile({ campaignId: secondaryCampaign.id, ownerUserId: 'owner', originalName: 'file.txt', sizeBytes: 10, contentType: 'text/plain', storageProvider: 'local', storageKey: 'secondary-file' });
    assert.equal((await campaigns.listFiles(secondaryCampaign.id)).length, 1);
  });
  await workspaceContext.run(first, async () => {
    assert.equal((await profiles.getBrandProfile('owner')).companyName, 'Original Brand');
    assert.equal(await profiles.getBrandLogo('owner'), null);
    assert.deepEqual((await campaigns.listByOwner('owner')).map(c => c.id), [original.id]);
    assert.equal(await campaigns.getByIdForOwner('owner', secondaryCampaign.id), null);
    assert.deepEqual(await campaigns.listFiles(secondaryCampaign.id), []);
    await favorites.addFavorite('owner', 'creator');
    assert.deepEqual(await favorites.listFavoriteIds('owner'), ['creator']);
    firstThread = await inbox.ensureThread('owner', 'creator', original.id);
    assert.notEqual(firstThread.id, secondThread.id);
    assert.equal(await inbox.getThreadForUser('owner', secondThread.id), null);
    await assert.rejects(inbox.ensureThread('owner', 'creator', secondaryCampaign.id), /not available/);
    await inbox.createMessage({ threadId: firstThread.id, senderUserId: 'owner', recipientUserId: 'creator', subject: 'First', content: 'First brand message' });
    assert.equal((await inbox.listMessagesForUser('owner')).length, 1);
    await favorites.removeFavorite('owner', 'creator');
    assert.deepEqual(await favorites.listFavoriteIds('owner'), []);
  });
  await workspaceContext.run(secondAccess, async () => assert.deepEqual(await favorites.listFavoriteIds('owner'), ['creator']));
  // Creator responses have no selected brand: derive the conversation from the
  // campaign, never from the vendor's shared login identity.
  assert.equal((await inbox.ensureThread('owner', 'creator', secondaryCampaign.id)).id, secondThread.id);
  assert.equal((await inbox.listThreadsForUser('creator')).length, 2);
  assert.equal((await inbox.listMessagesForUser('creator')).length, 2);
  assert.equal((await inbox.getContactDisplay('creator', 'owner', second.id)).name, 'Second Brand Updated');
  assert.equal((await inbox.getContactDisplay('creator', 'owner', first.workspaceId)).name, 'Original Brand');
  await inbox.createMessage({ threadId: secondThread.id, senderUserId: 'creator', recipientUserId: 'owner', subject: 'Reply', content: 'Second brand reply' });
  await workspaceContext.run(first, async () => assert.equal((await inbox.listMessagesForUser('owner')).length, 1));
  await workspaceContext.run(secondAccess, async () => assert.equal((await inbox.listMessagesForUser('owner')).length, 2));
  const profileRows = await query(`SELECT user_id,workspace_id FROM thesi.brand_profile ORDER BY user_id NULLS LAST`);
  assert(profileRows.some(p => p.user_id === null && p.workspace_id === second.id));
  assert.equal((await profiles.getBrandLogo('ignored', second.id)).storageKey, 'secondary');

  // Parent-derived rows, including creator-side snapshots and financial records,
  // must use the secondary brand even when the actor has no brand context.
  await query(`INSERT INTO thesi.marketplace_listing(campaign_id,owner_user_id,brand_name,name,campaign_type,status,start_date,end_date,application_deadline)
    VALUES ($1,'owner','Second Brand','Listing','experience','open','2026-01-01','2026-12-31','2026-12-01')`, [secondaryCampaign.id]);
  await query(`INSERT INTO thesi.campaign_invite(campaign_id,brand_user_id,campaign_name,brand_name,creator_user_id,creator_email,creator_name)
    VALUES ($1,'owner','Campaign','Second Brand','creator','creator@example.test','Creator')`, [secondaryCampaign.id]);
  await query(`INSERT INTO thesi.campaign_acceptance_snapshot(campaign_id,brand_user_id,creator_user_id,creator_email,creator_name,source,source_id,
    campaign_name,campaign_type,content_types,start_date,end_date,brief,deliverables,payment_snapshot,creator_benefits_snapshot,products_provided_snapshot,content_rights_snapshot,required_tasks_snapshot)
    VALUES ($1,'owner','creator','creator@example.test','Creator','campaign_invite','fixture','Campaign','experience','[]','2026-01-01','2026-12-31','','','{}','{}','[]','{}','[]')`, [secondaryCampaign.id]);
  await query(`INSERT INTO thesi.campaign_platform_fee(campaign_id,brand_user_id,payout_cents,fee_cents,status,idempotency_key)
    VALUES ($1,'owner',10000,200,'paid','fixture')`, [secondaryCampaign.id]);
  await query(`INSERT INTO thesi.creator_payout(campaign_id,brand_user_id,creator_user_id,amount_cents,status,stripe_destination_account_id,idempotency_key)
    VALUES ($1,'owner','creator',10000,'transferred','acct_fixture','fixture')`, [secondaryCampaign.id]);
  for (const table of ['marketplace_listing','campaign_invite','campaign_acceptance_snapshot','campaign_platform_fee','creator_payout']) {
    assert.equal((await query(`SELECT workspace_id FROM thesi.${table} WHERE campaign_id::text=$1`, [secondaryCampaign.id]))[0].workspace_id, second.id);
  }
  await workspaceContext.run(first, async () => {
    assert.equal((await marketplace.listByOwner('owner')).length, 0);
    assert.equal(await campaigns.getPlatformFee(secondaryCampaign.id), null);
    assert.deepEqual(await campaigns.listCreatorPayoutsForCampaign(secondaryCampaign.id), []);
  });
  await workspaceContext.run(secondAccess, async () => {
    assert.equal((await marketplace.listByOwner('owner')).length, 1);
    assert((await campaigns.getPlatformFee(secondaryCampaign.id)));
    assert.equal((await campaigns.listCreatorPayoutsForCampaign(secondaryCampaign.id)).length, 1);
  });
  await assert.rejects(campaign('other', second.id), /workspace owner/);
  await assert.rejects(query(`UPDATE thesi.campaign SET workspace_id=$1 WHERE id=$2`, [first.workspaceId, secondaryCampaign.id]), /Moving historical/);
  await assert.rejects(query(`UPDATE thesi.campaign_file SET workspace_id=$1 WHERE campaign_id=$2`, [first.workspaceId, secondaryCampaign.id]), /match campaign/);
  await assert.rejects(query(`UPDATE thesi.brand_workspace SET owner_user_id='other' WHERE id=$1`, [second.id]), /ownership transfer/);
  await user('new-owner'); // Old registration trigger still works after V34.
  const inventory = await audit(db);
  assert(inventory.multiBrandInstalled);
  assert.equal(inventory.missingOwnerMemberships, 0);
  assert(inventory.ownership.every(row => row.invalid_owner === 0 && row.missing_workspace === 0 && row.conflicting_workspace === 0));
  assert(inventory.campaignOwnerConflicts.every(row => row.count === 0));
  await query(`UPDATE thesi.brand_workspace_member SET status='revoked' WHERE workspace_id=$1`, [second.id]);
  await assert.rejects(service.resolveLegacyAccess('owner', second.id), /not available/);
  await query(`UPDATE thesi.brand_workspace_member SET status='active' WHERE workspace_id=$1`, [second.id]);
  await query(`UPDATE thesi.brand_workspace SET status='archived' WHERE id=$1`, [second.id]);
  await assert.rejects(service.resolveLegacyAccess('owner', second.id), /not available/);
  assert.equal(await profiles.getBrandLogo('ignored', second.id), null);
  console.log('PASS: V34 backfill gate; real owner-managed two-brand create/read/update isolation; creation retry; pause creation with access retained; profile/logo uniqueness; favorites; campaign-derived inbox and creator replies; parent/child attribution; fee/payout boundaries; aggregate audit; revoked/archived access');
} finally { await db.close(); }
