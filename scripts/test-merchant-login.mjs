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
  for(const file of files)await migrate(file);
  const require=createRequire(path.join(root,'thesi-api/package.json'));require('reflect-metadata');
  const Module=require('node:module'),resolve=Module._resolveFilename;
  Module._resolveFilename=function(p,...rest){if(p==='@electric-sql/pglite')return path.join(path.dirname(path.resolve(process.argv[2])),'index.cjs');return resolve.call(this,p.startsWith('src/')?path.join(root,'thesi-api/dist',p.slice(4)):p,...rest);};
  const {drizzle}=require('drizzle-orm/pglite');const database=drizzle(db);
  const load=p=>require(path.join(root,'thesi-api/dist',p));
  const {MerchantLoginService}=load('api/merchant-links/merchant-login.service.js');
  const {MerchantAccessService}=load('shared/auth/merchant-access.service.js');
  const {AuthService}=load('api/auth/auth.service.js');
  const {PasswordService}=load('shared/auth/password.service.js');
  const {BrandWorkspacesService}=load('api/brand-workspaces/brand-workspaces.service.js');
  const {digest}=load('api/merchant-links/merchant-links.service.js');
  const {JwtService}=require('@nestjs/jwt');const jwt=new JwtService({secret:'local-fixture-secret-not-for-use',signOptions:{expiresIn:'15m'}});
  const cfg={get:k=>({MERCHANT_SSO_ENABLED:true,MERCHANT_LINKING_ENABLED:true,BRAND_WORKSPACES_ENABLED:true,BRAND_WORKSPACE_ACCESS_ENABLED:true,MULTI_BRAND_ENABLED:true,AUTH_FORCE_PASSWORD_CHANGE:false,JWT_REFRESH_EXPIRATION:'7d'})[k],getOrThrow:k=>k==='MERCHANT_HUB_URL'?'https://merchant.example.test':'https://thesi.example.test'};
  const access=new MerchantAccessService(database,cfg);let enabled=true,staffPermission='member';const emails=new Map();
  const id=n=>`${String(n).padStart(8,'0')}-3333-4333-8333-333333333333`;
  const owner={vendorId:id(1),brandId:id(2),actorType:'owner',actorId:id(1)};
  const staff={...owner,actorType:'staff',actorId:id(3)};
  access.authority=async identity=>{if(!enabled)throw new Error('Merchant access removed');return {...identity,email:emails.get(identity.actorId)??(identity.actorType==='owner'?'merchant@example.test':'staff@example.test'),fullName:'Merchant actor',brandName:identity.brandId===id(2)?'Brand A':'Brand B',vendorName:'Merchant',permission:identity.actorType==='owner'?'owner':staffPermission};};
  const auth=new AuthService(database,new PasswordService(),jwt,cfg,{trigger:async()=>{throw new Error('No notifications permitted in test');}},access);
  const login=new MerchantLoginService(database,cfg,access,auth),workspaces=new BrandWorkspacesService(database,cfg,access);
  await login.onApplicationBootstrap();await workspaces.onApplicationBootstrap();
  const verifier='v'.repeat(43),state='s'.repeat(43);
  async function request(identity){const start=await login.begin(state,digest(verifier));const requestId=new URLSearchParams(new URL(start.url).hash.slice(1)).get('requestId');const approved=await login.authorize(requestId,identity);return new URLSearchParams(new URL(approved.url).hash.slice(1)).get('code');}
  const code=await request(owner);
  await assert.rejects(login.finish({code,verifier:'x'.repeat(43),consent:true}),/expired/);
  const first=await login.finish({code,verifier,consent:true});
  assert.equal(first.user.onboardingCompleted,false,'Merchant onboarding must not be skipped by legacy auth flag');
  const claims=jwt.verify(first.accessToken);assert.ok(claims.merchantSessionId);assert.ok(first.refreshToken.startsWith('mh.'));
  await assert.rejects(login.finish({code,verifier,consent:true}),/used/);
  const second=await login.finish({code:await request({...owner,brandId:id(4)}),verifier,consent:true});
  assert.equal(second.user.id,first.user.id);assert.notEqual(second.workspaceId,first.workspaceId);
  const refreshed=await auth.refresh({refreshToken:first.refreshToken});assert.equal(jwt.verify(refreshed.accessToken).merchantSessionId,claims.merchantSessionId);
  await assert.rejects(auth.refresh({refreshToken:first.refreshToken}),/expired|used/);
  const staffSession=await login.finish({code:await request(staff),verifier,consent:true});assert.notEqual(staffSession.user.id,first.user.id);
  assert.equal((await workspaces.resolveLegacyAccess(staffSession.user.id,first.workspaceId)).role,'member');
  await assert.rejects(workspaces.resolveLegacyAccess(staffSession.user.id,second.workspaceId),/available/);
  staffPermission='viewer';assert.equal((await workspaces.resolveLegacyAccess(staffSession.user.id,first.workspaceId)).role,'viewer');
  enabled=false;await assert.rejects(access.session(staffSession.user.id,jwt.verify(staffSession.accessToken).merchantSessionId),/removed/);
  await assert.rejects(auth.refresh({refreshToken:staffSession.refreshToken}),/removed/);enabled=true;
  await login.revokeActor(owner);await assert.rejects(access.session(first.user.id,claims.merchantSessionId),/revoked/);
  const fresh=await login.finish({code:await request(owner),verifier,consent:true});
  await query('UPDATE thesi.merchant_brand_link SET revoked_at=now() WHERE workspace_id=$1',[first.workspaceId]);
  await assert.rejects(access.session(fresh.user.id,jwt.verify(fresh.accessToken).merchantSessionId),/revoked/);
  // Matching email alone cannot take over an existing standalone brand account.
  await query("UPDATE thesi.merchant_identity SET actor_id=$1 WHERE actor_type='owner'",[id(99)]);
  const conflictCode=await request(owner);assert.equal((await login.inspect(conflictCode,verifier)).requiresAccountProof,true);
  await assert.rejects(login.finish({code:conflictCode,verifier,consent:true}),/existing Thesi account/);
  await user('existing');await user('local-staff');await user('creator','creator');
  const oldWorkspace=(await query("SELECT id FROM thesi.brand_workspace WHERE legacy_owner_user_id='existing'"))[0].id;
  const historical=await campaign('existing',oldWorkspace);
  await query("INSERT INTO thesi.brand_workspace_member(workspace_id,user_id,role) VALUES($1,'local-staff','member')",[oldWorkspace]);
  const existingOwner={vendorId:id(70),brandId:id(71),actorType:'owner',actorId:id(70)};
  emails.set(id(70),'existing@example.test');
  const existingCode=await request(existingOwner);
  await assert.rejects(login.finish({code:existingCode,verifier,consent:true,workspaceId:oldWorkspace},'existing'),/replacing existing local staff/);
  assert.equal((await query("SELECT status FROM thesi.brand_workspace_member WHERE workspace_id=$1 AND user_id='local-staff'",[oldWorkspace]))[0].status,'active');
  const linked=await login.finish({code:existingCode,verifier,consent:true,workspaceId:oldWorkspace,replaceLocalAccess:true},'existing');
  assert.equal(linked.user.id,'existing');assert.equal(linked.workspaceId,oldWorkspace);
  assert.equal((await query("SELECT status FROM thesi.brand_workspace_member WHERE workspace_id=$1 AND user_id='local-staff'",[oldWorkspace]))[0].status,'revoked');
  assert.equal((await query('SELECT workspace_id FROM thesi.campaign WHERE id=$1',[historical.id]))[0].workspace_id,oldWorkspace);
  const creatorOwner={vendorId:id(80),brandId:id(81),actorType:'owner',actorId:id(80)};
  emails.set(id(80),'creator@example.test');
  await assert.rejects(login.finish({code:await request(creatorOwner),verifier,consent:true},'creator'),/creator accounts are never converted/);
  await assert.rejects(login.finish({code:await request(existingOwner),verifier,consent:true},'local-staff'),/Sign out of the other/);
  await assert.rejects(query("UPDATE thesi.merchant_login_audit SET event='changed'"),/immutable/);
  console.log('PASS: two-brand passwordless provisioning, explicit account proof, single-use PKCE handoff, onboarding preservation, refresh provenance/replay, distinct staff actor, live permission downgrade, cross-brand denial, logout and disconnect revocation, immutable audit.');
} finally {await db.close();}
