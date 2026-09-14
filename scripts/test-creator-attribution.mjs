// Disposable embedded PostgreSQL test. Pass an installed PGlite module path.
// No production credentials/connections. --docker uses fixed loopback-only fixture databases.
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';
import { audit, ownership } from './audit-brand-workspaces.mjs';

if (!process.argv[2]) throw new Error('Pass the path to an installed @electric-sql/pglite module');
const { PGlite } = await import(pathToFileURL(path.resolve(process.argv[2])).href);
const docker=process.argv.includes('--docker');
const {creatorDemoDatabase}=await import('./creator-demo-database.mjs');
const makeDatabase=()=>docker?creatorDemoDatabase():new PGlite();
const db = await makeDatabase();
const rulesMode=process.argv.includes('--rules');
const multi = rulesMode || process.argv.includes('--multi');
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
  await migrate(files.find(f => f.startsWith('V36__')));
  if (multi) await migrate(files.find(f => f.startsWith('V41__')));
  if(process.argv.includes('--earnings') || process.argv.includes('--funding')) await migrate(files.find(f => f.startsWith('V37__')));
  if(process.argv.includes('--funding')) {await migrate(files.find(f => f.startsWith('V38__')));await migrate(files.find(f=>f.startsWith('V39__')));}
  const require = createRequire(path.join(root, 'thesi-api/package.json'));
  require('reflect-metadata');
  const Module = require('node:module'); const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function(request, ...rest) {
    if (request === '@electric-sql/pglite') return path.join(path.dirname(path.resolve(process.argv[2])), 'index.cjs');
    return originalResolve.call(this, request.startsWith('src/') ? path.join(root, 'thesi-api/dist', request.slice(4)) : request, ...rest);
  };
  const { drizzle } = require(docker?'drizzle-orm/node-postgres':'drizzle-orm/pglite');
  const database = drizzle(db.$pool??db);
  const { CreatorTrackingService,clickDigest } = require(path.join(root,'thesi-api/dist/api/creator-tracking/creator-tracking.service.js'));
  const workspace=(await query("SELECT id FROM thesi.brand_workspace WHERE owner_user_id='owner'"))[0].id;
  const id=n=>`${String(n).padStart(8,'0')}-1111-4111-8111-111111111111`;
  const [merchantLink]=await query(`INSERT INTO thesi.merchant_brand_link(vendor_id,merchant_brand_id,vendor_name,merchant_brand_name,workspace_id,linked_by_user_id) VALUES ($1,$2,'Vendor','Brand',$3,'owner') RETURNING id`,[id(1),id(2),workspace]);
  const payment={model:'commission',hybrid:{base:{enabled:true,amountCents:20000,currency:'USD',trigger:'content_accepted'},affiliate:{enabled:true,commissionType:'percentage_of_sale',commissionPercent:10,currency:'USD',attributionWindowDays:30,terms:'Eligible sales after returns.'}},
    promotedProduct:{productId:id(3),brandId:id(2),vendorId:id(1),workspaceId:workspace,linkId:merchantLink.id,title:'Shirt',description:'Linen',brandName:'Brand',imageUrl:null,previewUrl:'https://thesi.test/preview',verifiedAt:new Date().toISOString()}};
  if(multi){
    payment.promotedProducts=[{...payment.promotedProduct,variants:[{id:id(30),color:'Blue',size:'M',priceCents:5000,currency:'USD'}]},{...payment.promotedProduct,productId:id(5),title:'Trousers',variants:[{id:id(31),color:'Black',size:'L',priceCents:6000,currency:'USD'}]}];
    payment.promotedProduct=payment.promotedProducts[0];
  }
  if(rulesMode){payment.hybrid.affiliate.rules={version:1,reviewDays:30,payoutFrequency:'on_approval',minimumPayoutCents:0,creatorFeeCents:0,creditPolicy:'hold_until_verified',selfReferralPolicy:'hold_until_reviewed'};}
  if(process.argv.includes('--funding')) {const {verifyFunding}=await import('./verify-campaign-funding.mjs');await verifyFunding({root,require,database,query,workspace,payment,id});}
  if(process.argv.includes('--commission-only')) delete payment.hybrid.base;
  const [c]=await query(`INSERT INTO thesi.campaign(owner_user_id,workspace_id,name,campaign_type,status,start_date,end_date,payment)
    VALUES ('owner',$1,'Campaign','product','active',CURRENT_DATE-1,CURRENT_DATE+30,$2::jsonb) RETURNING *`,[workspace,JSON.stringify(payment)]);
  const productReader={preview:async()=>({title:'Shirt',description:'Linen',imageUrl:null,brandName:'Brand'})};
  let newLinks=true;
  const tracking=new CreatorTrackingService(database,{get:key=>key==='CREATOR_LINKS_ENABLED'?newLinks:true,getOrThrow:()=> 'https://thesi.test'},productReader);
  await tracking.onApplicationBootstrap();
  await assert.rejects(tracking.issue('creator',c.id),/Accept this campaign/);
  const { PostgresInvitesRepository }=require(path.join(root,'thesi-api/dist/api/invites/postgres-invites.repository.js'));
  await new PostgresInvitesRepository(database).createAcceptanceSnapshot({campaignId:c.id,brandUserId:'owner',creatorUserId:'creator',creatorEmail:'creator@example.test',creatorName:'Creator',source:'campaign_invite',sourceId:id(4)});
  await assert.rejects(tracking.issue('other',c.id),/Accept this campaign/);
  const mine=await tracking.mine('creator');assert.equal(mine.campaigns.length,multi?2:1);
  const link=await tracking.issue('creator',c.id);assert.deepEqual(await tracking.issue('creator',c.id),link);
  if(!multi && process.argv.includes('--v41')){await migrate(files.find(f=>f.startsWith('V41__')));assert.deepEqual(await tracking.issue('creator',c.id),link);}
  if(multi){
    const second=await tracking.issue('creator',c.id,id(5));
    assert.notEqual(second.url,link.url);assert.deepEqual(await tracking.issue('creator',c.id,id(5)),second);
    await assert.rejects(tracking.issue('creator',c.id,id(99)),/product/i);
    const secondGrant=(await tracking.click(second.url.split('/').at(-1))).deepLink.split('/').at(-1);
    const secondReceipt=await tracking.claim(secondGrant,'c'.repeat(43));
    assert.equal(secondReceipt.productId,id(5));assert.deepEqual(secondReceipt.eligibleVariantIds,[id(31)]);
    // Product edits after acceptance cannot rewrite the signed terms or change either creator link.
    await query(`UPDATE thesi.campaign SET payment=jsonb_set(payment,'{promotedProducts,0,variants,0,priceCents}','9999') WHERE id=$1`,[c.id]);
    assert.deepEqual(await tracking.issue('creator',c.id),link);
  }
  const code=link.url.split('/').at(-1);assert.match(code,/^[A-Za-z0-9_-]{43}$/);
  await tracking.preview(code);assert.equal((await query('SELECT count(*)::int AS n FROM thesi.creator_click_grant'))[0].n,multi?1:0);
  const handoff=await tracking.click(code);const grantCode=handoff.deepLink.split('/').at(-1);
  const claimed=await tracking.claim(grantCode,'a'.repeat(43));
  assert.equal(claimed.version,rulesMode?3:multi?2:1);if(multi)assert.deepEqual(claimed.eligibleVariantIds,[id(30)]);
  assert.equal(claimed.productId,id(3));assert.equal(claimed.creatorId,'creator');
  assert.deepEqual(await tracking.claim(grantCode,'a'.repeat(43)),claimed);
  newLinks=false;
  await assert.rejects(tracking.click(code),/paused/);
  assert.deepEqual(await tracking.validate(claimed.receiptId,'a'.repeat(43)),claimed);
  newLinks=true;
  await assert.rejects(tracking.claim(grantCode,'b'.repeat(43)),/another shopper/);
  await assert.rejects(tracking.validate(claimed.receiptId,'b'.repeat(43)),/expired or is unavailable/);
  await query("UPDATE thesi.campaign SET status='completed' WHERE id=$1",[c.id]);
  assert.deepEqual(await tracking.validate(claimed.receiptId,'a'.repeat(43)),claimed);
  await assert.rejects(tracking.click(code),/unavailable/);
  await query("UPDATE thesi.campaign SET status='active' WHERE id=$1",[c.id]);
  const expiredCode=(await tracking.click(code)).deepLink.split('/').at(-1);
  await query("UPDATE thesi.creator_click_grant SET clicked_at=now()-interval '1 hour',redeem_until=now()-interval '1 minute' WHERE code_hash=$1",[clickDigest(expiredCode)]);
  await assert.rejects(tracking.claim(expiredCode,'a'.repeat(43)),/expired/);
  const commerce=await makeDatabase();
  try {
    const folder=path.resolve(root,'../clothme-db/databases/commerce/sql');
    const migrations=(await readdir(folder)).filter(f=>/^V\d+__.*\.sql$/.test(f)).sort((a,b)=>Number(a.match(/^V(\d+)/)[1])-Number(b.match(/^V(\d+)/)[1]));
    for(const file of migrations) await commerce.exec((await readFile(path.join(folder,file),'utf8')).replace('CREATE EXTENSION IF NOT EXISTS pgcrypto;',''));
    const pool=commerce.$pool??{query:(text,params=[])=>commerce.query(text,params),connect:async()=>({query:(text,params=[])=>commerce.query(text,params),release:()=>{}})};
    const customerRequire=createRequire(path.resolve(root,'../customer-api/package.json'));
    const { CreatorAttributionService }=customerRequire(path.resolve(root,'../customer-api/dist/modules/commerce/application/creator-attribution.service.js'));
    const { PostgresOrderRepository }=customerRequire(path.resolve(root,'../customer-api/dist/modules/commerce/infrastructure/postgres-order.repository.js'));
    const config={get:()=>true,getOrThrow:key=>key==='THESI_API_URL'?'https://thesi.test':'k'.repeat(32)};
    const customer=new CreatorAttributionService(pool,config);await customer.onApplicationBootstrap();
    const originalFetch=globalThis.fetch;
    globalThis.fetch=async(url,options)=>{
      const body=JSON.parse(options.body);
      try {const data=String(url).endsWith('/click')?await tracking.click(body.code):String(url).endsWith('/claim')?await tracking.claim(body.code,body.buyerKey):await tracking.validate(body.receiptId,body.buyerKey);return {ok:true,status:200,json:async()=>({data})};}
      catch(e){return {ok:false,status:e.getStatus?.()??500,json:async()=>({message:e.message})};}
    };
    try {
      if(process.argv.includes('--http')){const {verifyCreatorHandoffHttp}=await import('./verify-creator-handoff-http.mjs');await verifyCreatorHandoffHttp({root,customer,customerRequire,id,code,fetch:originalFetch});}
      if(process.argv.includes('--browser-demo')) {
        const {serveCreatorDemo}=await import('./creator-link-demo-server.mjs');
        await serveCreatorDemo({tracking,customer,commerce,PostgresOrderRepository,pool,code,id,multi});
      } else {
      const beforePrepare=(await commerce.query('SELECT count(*)::int AS n FROM commerce.creator_touchpoint')).rows[0].n;
      const fresh=(await customer.prepare(code)).code;
      assert.equal((await commerce.query('SELECT count(*)::int AS n FROM commerce.creator_touchpoint')).rows[0].n,beforePrepare,'preparing must not claim attribution before consent/claim');
      await customer.claim(id(10),id(11),fresh);
      const firstTouch=(await commerce.query('SELECT * FROM commerce.creator_touchpoint')).rows[0];
      await customer.claim(id(10),id(11),fresh);assert.deepEqual((await commerce.query('SELECT * FROM commerce.creator_touchpoint')).rows[0],firstTouch);
      const newer=(await tracking.click(code)).deepLink.split('/').at(-1);
      await customer.claim(id(10),id(11),newer);
      const latestTouch=(await commerce.query('SELECT * FROM commerce.creator_touchpoint')).rows[0];
      assert.notEqual(latestTouch.receipt_id,firstTouch.receipt_id);
      await customer.claim(id(10),id(11),fresh);
      assert.deepEqual((await commerce.query('SELECT * FROM commerce.creator_touchpoint')).rows[0],latestTouch);
      assert.deepEqual(await customer.forCheckout(id(10),id(12),[id(3)]),[]);
      assert.deepEqual(await customer.forCheckout(id(10),id(11),[id(99)]),[]);
      const receipts=await customer.forCheckout(id(10),id(11),[id(3)]);assert.equal(receipts.length,1);
      const [cart]=(await commerce.query('INSERT INTO commerce.cart(account_id,person_id) VALUES($1,$2) RETURNING id',[id(10),id(11)])).rows;
      let fixtureLine=0;
      for(const [productId,vendorId,brandId] of [[id(3),id(1),id(2)],[multi?id(3):id(99),id(1),id(2)],[id(3),id(99),id(2)],[id(3),id(1),id(99)]])await commerce.query(`INSERT INTO commerce.cart_item(cart_id,account_id,person_id,product_id,vendor_id,brand_id,quantity,unit_amount_cents,variant_id) VALUES($1,$2,$3,$4,$5,$6,1,5000,$7)`,[cart.id,id(10),id(11),productId,vendorId,brandId,multi?id(fixtureLine++===0?30:32):null]);
      const orders=new PostgresOrderRepository(pool);const order=await orders.placeOrder({accountId:id(10),personId:id(11),cartId:cart.id,attributions:receipts});
      const attrs=(await commerce.query('SELECT a.*,l.product_id FROM commerce.order_line_creator_attribution a JOIN commerce.order_line l ON l.id=a.order_line_id')).rows;
      assert.equal(attrs.length,1);assert.equal(attrs[0].product_id,id(3));assert.equal(attrs[0].snapshot.creatorId,'creator');assert.equal(order.status,'pending');
      assert.equal((await commerce.query('SELECT count(*)::int AS n FROM commerce.payment')).rows[0].n,0);
      if(rulesMode){const {verifyCreditHold}=await import('./verify-credit-hold.mjs');await verifyCreditHold({root,customerRequire,commerce,pool,order});}
      if(process.argv.includes('--earnings')) {
        const {verifyEarnings}=await import('./verify-commission-earnings.mjs');
        await verifyEarnings({root,require,customerRequire,database,query,commerce,pool,order,attrs,id,workspace,merchantLink});
      }
      // A failed attribution insert must roll back order placement and cart checkout together.
      const [retryCart]=(await commerce.query('INSERT INTO commerce.cart(account_id,person_id) VALUES($1,$2) RETURNING id',[id(10),id(11)])).rows;
      await commerce.query(`INSERT INTO commerce.cart_item(cart_id,account_id,person_id,product_id,vendor_id,brand_id,quantity,unit_amount_cents,variant_id) VALUES($1,$2,$3,$4,$5,$6,1,5000,$7)`,[retryCart.id,id(10),id(11),id(3),id(1),id(2),multi?id(30):null]);
      await assert.rejects(orders.placeOrder({accountId:id(10),personId:id(11),cartId:retryCart.id,attributions:[{...receipts[0],receiptId:'invalid'}]}));
      assert.equal((await commerce.query('SELECT count(*)::int AS n FROM commerce."order"')).rows[0].n,1);
      assert.equal((await commerce.query('SELECT status FROM commerce.cart WHERE id=$1',[retryCart.id])).rows[0].status,'active');
      await query('UPDATE thesi.merchant_brand_link SET revoked_at=now() WHERE id=$1',[merchantLink.id]);
      assert.deepEqual(await customer.forCheckout(id(10),id(11),[id(3)]),[]);
      assert.equal((await commerce.query('SELECT count(*)::int AS n FROM commerce.order_line_creator_attribution')).rows[0].n,1);
      await assert.rejects(tracking.validate(claimed.receiptId,'a'.repeat(43)),/unavailable/);
      if(process.argv.includes('--sales-reserve')){const {verifySalesReserve}=await import('./verify-sales-reserve.mjs');await verifySalesReserve({root,customerRequire,commerce,pool,order,attrs});}
      }
    } finally {globalThis.fetch=originalFetch;}
  } finally {await commerce.close();}
  console.log(process.argv.includes('--browser-demo') ? 'Stopped creator demo; disposable databases are closing.' : process.argv.includes('--earnings') ? 'PASS: attribution plus commission integration (disposable databases only).' : 'PASS: accepted-creator links, preview without clicks, buyer-bound grants, replay/expiry, fixed windows, person/product isolation, atomic pending-order attribution, revoked-link rejection, no payment or earnings creation.');
} finally {await db.close();}
