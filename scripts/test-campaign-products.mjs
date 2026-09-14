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
  const { PostgresCampaignRepository } = require(path.join(root, 'thesi-api/dist/api/campaigns/postgres-campaign.repository.js'));
  const { PostgresInvitesRepository } = require(path.join(root, 'thesi-api/dist/api/invites/postgres-invites.repository.js'));
  const { workspaceContext } = require(path.join(root, 'thesi-api/dist/api/brand-workspaces/workspace-context.js'));
  const { buildListingPayload } = require(path.join(root, 'thesi-api/dist/api/marketplace/marketplace-listing.mapper.js'));
  const workspace = (await query("SELECT id FROM thesi.brand_workspace WHERE owner_user_id='owner'"))[0].id;
  const vendor = '11111111-1111-4111-8111-111111111111', brand = '22222222-2222-4222-8222-222222222222';
  const [link] = await query(`INSERT INTO thesi.merchant_brand_link(vendor_id,merchant_brand_id,vendor_name,merchant_brand_name,workspace_id,linked_by_user_id)
    VALUES ($1,$2,'Vendor','Brand',$3,'owner') RETURNING id`, [vendor,brand,workspace]);
  const product = { productId: '33333333-3333-4333-8333-333333333333', brandId: brand, vendorId: vendor, workspaceId: workspace, linkId: link.id,
    title: 'Shirt', description: 'Linen shirt', brandName: 'Brand', imageUrl: null, previewUrl: 'https://thesi.test/preview', verifiedAt: '2026-09-12T00:00:00.000Z' };
  const input = { name:'Product campaign',campaignType:'product',contentTypes:['tiktok'], status:'draft', startDate:'2026-01-01', endDate:'2026-12-31',brief:'Brief',deliverables:'Deliverables',exampleVideoLinks:[],
    requirements:{niches:[],minFollowersRange:'',location:'',platforms:[]}, payment:{model:'commission',promotedProduct:product},requiredTasks:[],creatorBenefits:{},contentRights:{},productsProvided:[],postToMarketplace:false };
  const repo = new PostgresCampaignRepository(database);
  const invites = new PostgresInvitesRepository(database);
  await workspaceContext.run({ workspaceId:workspace,actorUserId:'owner',role:'owner' }, async () => {
    const created = await repo.create('owner', input);
    assert.deepEqual(created.payment.promotedProduct, product);
    const published = await repo.update('owner', created.id, {...input,status:'active'});
    assert.deepEqual(buildListingPayload(published,'Brand').payment.promotedProduct, product);
    await assert.rejects(repo.update('owner',created.id,{...input,status:'active',payment:{model:'commission',promotedProduct:{...product,productId:brand}}}), /locked after publishing/);
    await assert.rejects(repo.update('owner',created.id,input), /cannot return to draft/);
    await invites.createAcceptanceSnapshot({ campaignId:created.id,brandUserId:'owner',creatorUserId:'creator',creatorEmail:'creator@example.test',creatorName:'Creator',source:'campaign_invite',sourceId:brand });
    const [accepted] = await query('SELECT payment_snapshot FROM thesi.campaign_acceptance_snapshot WHERE campaign_id=$1',[created.id]);
    assert.deepEqual(accepted.payment_snapshot.promotedProduct,product);
    await query('UPDATE thesi.merchant_brand_link SET revoked_at=now() WHERE id=$1',[link.id]);
    const retained = await repo.update('owner',created.id,{...input,status:'active',endDate:'2027-01-01'});
    assert.deepEqual(retained.payment.promotedProduct,product);
    await assert.rejects(repo.create('owner',input), /Merchant connection changed/);
    const [after] = await query('SELECT payment_snapshot FROM thesi.campaign_acceptance_snapshot WHERE campaign_id=$1',[created.id]);
    assert.deepEqual(after.payment_snapshot,accepted.payment_snapshot);
    assert.equal((await query('SELECT count(*)::int AS n FROM thesi.campaign'))[0].n,1);
  });
  console.log('PASS: product snapshot persistence, publication lock, marketplace mapping, accepted snapshot and revoked-link write protection.');
} finally { await db.close(); }
