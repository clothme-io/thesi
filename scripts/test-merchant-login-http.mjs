// Local-only connected API test. Actual Nest controllers, guards, services and
// PostgreSQL repositories; isolated databases on the Docker payments-demo server.
// No production configuration, email, payment provider or remote URL is loaded.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile,readdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'thesi-api/package.json'));
const vr=createRequire(path.resolve(root,'../vendor-api/package.json'));
require('reflect-metadata');
const Module=require('node:module'),resolve=Module._resolveFilename;
Module._resolveFilename=function(p,...rest){return resolve.call(this,p.startsWith('src/')?path.join(root,'thesi-api/dist',p.slice(4)):p,...rest);};
const t=p=>require(path.join(root,'thesi-api/dist',p));
const v=p=>vr(path.resolve(root,'../vendor-api/dist',p));
const {Pool}=require('pg'),{drizzle}=require('drizzle-orm/node-postgres');
const {Test}=require('@nestjs/testing'),{ConfigService}=require('@nestjs/config'),{JwtService}=require('@nestjs/jwt');
const {ValidationPipe}=require('@nestjs/common');
const names=['thesi','catalog'].map(p=>`identity_test_${p}_${randomBytes(6).toString('hex')}`);
const options={host:'127.0.0.1',port:5844,user:'demo',password:'demo-local-only'};
const admin=new Pool({...options,database:'postgres'}),pools=[],apps=[];
const id=n=>`${String(n).padStart(8,'0')}-3333-4333-8333-333333333333`;
const key='local-only-identity-key-000000000000000000';
const values={MERCHANT_SSO_ENABLED:true,THESI_SSO_ENABLED:true,MERCHANT_LINKING_ENABLED:true,BRAND_WORKSPACES_ENABLED:true,BRAND_WORKSPACE_ACCESS_ENABLED:true,MULTI_BRAND_ENABLED:true,AUTH_FORCE_PASSWORD_CHANGE:false,JWT_SECRET:'local-only-http-test-token-secret',JWT_EXPIRATION:'15m',JWT_REFRESH_EXPIRATION:'7d',MERCHANT_IDENTITY_SERVICE_KEY:key,THESI_IDENTITY_SERVICE_KEY:key,THESI_API_URL:'http://127.0.0.1:5013',MERCHANT_API_URL:'http://127.0.0.1:5031',THESI_WEB_URL:'http://127.0.0.1:3013',MERCHANT_HUB_URL:'http://127.0.0.1:3040'};
const productMode=process.argv.includes('--products');
if(productMode)Object.assign(values,{CAMPAIGN_PRODUCTS_ENABLED:true,CAMPAIGN_MULTI_PRODUCTS_ENABLED:true,THESI_PRODUCTS_ENABLED:true,MERCHANT_CATALOG_SERVICE_KEY:key,THESI_CATALOG_SERVICE_KEY:key});
if(process.argv.includes('--rules'))values.COMMISSION_RULES_ENABLED=true;
const cfg=new ConfigService(values);
const hash=s=>createHash('sha256').update(s).digest('base64url');
async function request(origin,route,body,token,expected=201,headers={}){
 const response=await fetch(`${origin}/v1/${route}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`} : {}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await response.json();assert.equal(response.status,expected,`${route}: ${JSON.stringify(data)}`);return data.data??data.result??data;
}
const th=(...a)=>request(values.THESI_API_URL,...a),vendor=(...a)=>request(values.MERCHANT_API_URL,...a);
try{
 for(let i=0;i<names.length;i++){
  await admin.query(`CREATE DATABASE ${names[i]}`);
  const pool=new Pool({...options,database:names[i]});pools.push(pool);
  const dir=path.resolve(root,`../clothme-db/databases/${i?'catalog':'thesi'}/sql`);
  for(const file of (await readdir(dir)).filter(f=>/^V\d+__.*\.sql$/.test(f)).sort((a,b)=>+a.match(/^V(\d+)/)[1]-+b.match(/^V(\d+)/)[1])){
   try{await pool.query(await readFile(path.join(dir,file),'utf8'));}catch(e){throw new Error(`${file}: ${e.message}`);}
  }
 }
 const [pg,catalog]=pools,db=drizzle(pg);
 const {PostgresVendorRepository}=v('modules/identity/infrastructure/postgres-vendor.repository.js');
 const {PostgresBrandRepository}=v('modules/brands/infrastructure/postgres-brand.repository.js');
 const {PostgresStaffUserRepository}=v('modules/staff/infrastructure/postgres-staff.repository.js');
 const {JwtVendorTokenService}=v('modules/identity/infrastructure/jwt-vendor-token.service.js');
 const {ThesiIdentityService,ThesiIdentityController,ThesiSigninController,ThesiIdentityGuard}=v('modules/integrations/thesi/thesi-identity.js');
 const {VendorJwtAuthGuard}=v('platform/auth/vendor-jwt-auth.guard.js');
 const {StaffScopeGuard}=v('modules/staff/staff-scope.guard.js');
 const {ApiEnvelopeInterceptor}=v('platform/http/api-envelope.interceptor.js');
 const {DomainExceptionFilter}=v('platform/errors/domain-exception.filter.js');
 const {TOKEN_VERIFIER}=v('modules/identity/domain/token.ports.js');
 const {STAFF_USER_REPOSITORY}=v('modules/staff/domain/staff-user.repository.js');
 const vendors=new PostgresVendorRepository(catalog),brands=new PostgresBrandRepository(catalog),staff=new PostgresStaffUserRepository(catalog),tokens=new JwtVendorTokenService(cfg);
 const identity=new ThesiIdentityService(vendors,brands,staff,cfg);
 const {PostgresProductRepository}=v('modules/products/infrastructure/postgres-product.repository.js');
 const {ThesiCatalogService,ThesiCatalogController,ThesiCatalogGuard}=v('modules/integrations/thesi/thesi-products.js');
 const catalogService=new ThesiCatalogService(brands,vendors,new PostgresProductRepository(catalog));
 const vm=await vr('@nestjs/testing').Test.createTestingModule({controllers:[ThesiIdentityController,ThesiSigninController,...(productMode?[ThesiCatalogController]:[])],providers:[{provide:ThesiCatalogService,useValue:catalogService},ThesiCatalogGuard,{provide:vr('@nestjs/config').ConfigService,useValue:cfg},{provide:ThesiIdentityService,useValue:identity},{provide:TOKEN_VERIFIER,useValue:tokens},{provide:STAFF_USER_REPOSITORY,useValue:staff},ThesiIdentityGuard,VendorJwtAuthGuard,StaffScopeGuard]}).compile();
 const va=vm.createNestApplication({logger:false});apps.push(va);va.setGlobalPrefix('v1');va.enableCors();va.useGlobalPipes(new (vr('@nestjs/common').ValidationPipe)({whitelist:true,forbidNonWhitelisted:true,transform:true}));va.useGlobalInterceptors(new ApiEnvelopeInterceptor());va.useGlobalFilters(new DomainExceptionFilter());
 // Browser fixture adapter for the existing brand selector. Authentication,
 // brand ownership and catalog reads still use the real implementations.
 va.getHttpAdapter().get('/v1/brands/:id',async(req,res)=>{
  try{const actor=await tokens.verifyAccessToken((req.headers.authorization||'').replace(/^Bearer /,''));
   await identity.identity({vendorId:actor.vendorId,brandId:req.params.id,actorType:actor.actor,actorId:actor.actor==='owner'?actor.vendorId:actor.staffUserId});
   res.json({status:200,error:null,result:await brands.findById(actor.vendorId,req.params.id)});
  }catch{res.status(403).json({error:{message:'Brand unavailable'}});}
 });
 await va.listen(5031,'127.0.0.1');
 const {MerchantAccessService}=t('shared/auth/merchant-access.service.js');
 const {MerchantLoginService}=t('api/merchant-links/merchant-login.service.js');
 const {MerchantLoginController,MerchantLoginInternalController,MerchantIdentityGuard}=t('api/merchant-links/merchant-login.controller.js');
 const {AuthService}=t('api/auth/auth.service.js'),{AuthController}=t('api/auth/auth.controller.js');
 const {OnboardingController}=t('api/auth/onboarding.controller.js');
 const {PasswordService}=t('shared/auth/password.service.js'),{JwtAuthGuard}=t('shared/auth/jwt-auth.guard.js');
 const {BrandWorkspacesService}=t('api/brand-workspaces/brand-workspaces.service.js'),{BrandWorkspacesController}=t('api/brand-workspaces/brand-workspaces.controller.js');
 const {CampaignsController}=t('api/campaigns/campaigns.controller.js'),{CampaignsService}=t('api/campaigns/campaigns.service.js'),{PostgresCampaignRepository}=t('api/campaigns/postgres-campaign.repository.js'),{CampaignProductsService}=t('api/campaigns/campaign-products.service.js');
 const {WorkspaceAccessInterceptor}=t('api/brand-workspaces/workspace-access.interceptor.js');
 const passwords=new PasswordService(),jwt=new JwtService({secret:values.JWT_SECRET,signOptions:{expiresIn:'15m'}}),access=new MerchantAccessService(db,cfg);
 const auth=new AuthService(db,passwords,jwt,cfg,{trigger:async()=>{throw new Error('Email is disabled in this local test');}},access);
 const login=new MerchantLoginService(db,cfg,access,auth),workspaces=new BrandWorkspacesService(db,cfg,access);
 const products=new CampaignProductsService(db,cfg);
 const forbiddenAdapter=new Proxy({}, {get:()=>()=>{throw new Error('External payment/storage calls are prohibited in this identity test');}});
 const campaigns=new CampaignsService(new PostgresCampaignRepository(db),forbiddenAdapter,forbiddenAdapter,forbiddenAdapter,forbiddenAdapter,forbiddenAdapter,undefined,products);
 const tm=await Test.createTestingModule({controllers:[CampaignsController,MerchantLoginController,MerchantLoginInternalController,AuthController,OnboardingController,BrandWorkspacesController],providers:[{provide:CampaignsService,useValue:campaigns},{provide:CampaignProductsService,useValue:products},{provide:ConfigService,useValue:cfg},{provide:JwtService,useValue:jwt},{provide:MerchantAccessService,useValue:access},{provide:MerchantLoginService,useValue:login},{provide:AuthService,useValue:auth},{provide:BrandWorkspacesService,useValue:workspaces},MerchantIdentityGuard,JwtAuthGuard]}).compile();
 const ta=tm.createNestApplication({logger:false});apps.push(ta);ta.setGlobalPrefix('v1');ta.enableCors();ta.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));ta.useGlobalInterceptors(new WorkspaceAccessInterceptor(cfg,workspaces));await ta.listen(5013,'127.0.0.1');
 const owner=await vendors.register({id:id(1),email:'owner@merchant.example.test',passwordHash:await passwords.hash('Local-demo-only-2026!'),companyName:'Local Merchant',firstName:'Morgan',lastName:'Owner',country:'Canada',countryCode:'CA'});
 const brandA=await brands.create({vendorId:owner.id,name:'Demo Linen'}),brandB=await brands.create({vendorId:owner.id,name:'Demo Denim'});
 const employee=await staff.create({vendorId:owner.id,email:'staff@merchant.example.test',firstName:'Sam',lastName:'Staff',inviteTokenHash:'local-only',inviteExpiresAt:new Date(Date.now()+600000),scopes:['thesi:read','thesi:write'],assignments:[{brandId:brandA.id,brandLocationId:null}]});
 await staff.acceptInvite(employee.id,await passwords.hash('Local-demo-only-2026!'));
 const ownerToken=await tokens.issueAccessToken({vendorId:owner.id,actor:'owner'}),staffToken=await tokens.issueAccessToken({vendorId:owner.id,actor:'staff',staffUserId:employee.id,scopes:['thesi:read','thesi:write']});
 if(process.argv.includes('--browser')){
  const browserOwner=await vendors.register({email:'browser@merchant.example.test',passwordHash:await passwords.hash('Local-demo-only-2026!'),companyName:'Browser Merchant',firstName:'Browser',lastName:'Owner',country:'Canada',countryCode:'CA'});
  const browserBrand=await brands.create({vendorId:browserOwner.id,name:'Browser Linen'});
  const {runBrowser}=await import('./merchant-login-browser.mjs');
  await runBrowser({owner:browserOwner,brand:browserBrand,token:await tokens.issueAccessToken({vendorId:browserOwner.id,actor:'owner'})});
 }
 async function handoff(token,brandId){
  const state=randomBytes(32).toString('base64url'),verifier=randomBytes(32).toString('base64url');
  const start=await th('merchant-login/begin',{state,challenge:hash(verifier)});
  const requestId=new URLSearchParams(new URL(start.url).hash.slice(1)).get('requestId');
  const authorized=await vendor('thesi/signin/authorize',{requestId,brandId},token);
  const params=new URLSearchParams(new URL(authorized.url).hash.slice(1));assert.equal(params.get('state'),state);
  return {code:params.get('code'),verifier,consent:true};
 }
 const existingSignup=await th('auth/signup',{fullName:'Existing owner',email:'existing@merchant.example.test',password:'Local-demo-only-2026!',companyName:'Existing brand'});
 const existingSession=await th('auth/signin',{email:'existing@merchant.example.test',password:'Local-demo-only-2026!'},undefined,200);
 assert.equal(existingSession.user.id,existingSignup.user.id);assert.equal(jwt.verify(existingSession.accessToken).merchantSessionId,undefined);
 const existingWorkspace=(await th('brand-workspaces',undefined,existingSession.accessToken,200))[0].id;
 const historicalCampaign=await th('campaigns',{name:'Existing agreement history',campaignType:'experience',status:'draft',payment:{model:'flat_rate'},postToMarketplace:false},existingSession.accessToken);
 const existingVendor=await vendors.register({email:'existing@merchant.example.test',passwordHash:await passwords.hash('Local-demo-only-2026!'),companyName:'Existing Merchant',firstName:'Existing',lastName:'Owner',country:'Canada',countryCode:'CA'});
 const existingBrand=await brands.create({vendorId:existingVendor.id,name:'Existing Merchant brand'});
 const existingProof=await handoff(await tokens.issueAccessToken({vendorId:existingVendor.id,actor:'owner'}),existingBrand.id);
 await th('merchant-login/finish',{...existingProof,workspaceId:existingWorkspace},undefined,409);
 await th('merchant-login/finish',{...existingProof,workspaceId:existingWorkspace},'invalid-token',401);
 const connectedExisting=await th('merchant-login/finish',{...existingProof,workspaceId:existingWorkspace},existingSession.accessToken);
 assert.equal(connectedExisting.user.id,existingSession.user.id);assert.equal(connectedExisting.workspaceId,existingWorkspace);
 assert.equal((await th(`campaigns/${historicalCampaign.id}`,undefined,connectedExisting.accessToken,200)).id,historicalCampaign.id);
 await vendor('internal/thesi/identity',{vendorId:owner.id,brandId:brandA.id,actorType:'owner',actorId:owner.id},undefined,401);
 await th('internal/merchant-login/entry',{},undefined,401);
 await th('merchant-login/begin',{state:'invalid',challenge:'invalid'},undefined,400);
 const firstProof=await handoff(ownerToken,brandA.id);
 await th('merchant-login/finish',{...firstProof,verifier:'a'.repeat(43)},undefined,400);
 const first=await th('merchant-login/finish',firstProof);
 assert.equal(first.user.onboardingCompleted,false);
 assert.equal((await pg.query('SELECT count(*)::int n FROM thesi.brand_workspace WHERE owner_user_id=$1',[first.user.id])).rows[0].n,1);
 await th('merchant-login/finish',firstProof,undefined,400);
 const second=await th('merchant-login/finish',await handoff(ownerToken,brandB.id));
 assert.equal(first.user.id,second.user.id);assert.notEqual(first.workspaceId,second.workspaceId);
 if(productMode){const {verifyProducts}=await import('./verify-campaign-products-http.mjs');await verifyProducts({catalog,pg,session:second,brand:brandB,vendorId:owner.id,th,id,browser:process.argv.includes('--product-browser')});}
 const staffSession=await th('merchant-login/finish',await handoff(staffToken,brandA.id));
 assert.notEqual(staffSession.user.id,first.user.id);
 const staffBrands=await th('brand-workspaces',undefined,staffSession.accessToken,200);
 assert.deepEqual(staffBrands.map(b=>b.id),[first.workspaceId]);assert.equal(staffBrands[0].role,'member');
 const draft={name:'Staff-created draft',campaignType:'experience',status:'draft',payment:{model:'flat_rate'},postToMarketplace:false};
 const staffCampaign=await th('campaigns',draft,staffSession.accessToken);
 assert.equal((await pg.query('SELECT owner_user_id FROM thesi.campaign WHERE id=$1',[staffCampaign.id])).rows[0].owner_user_id,first.user.id);
 assert.equal((await th('campaigns',undefined,staffSession.accessToken,200)).campaigns.length,1);
 await th(`campaigns/${staffCampaign.id}`,undefined,second.accessToken,404);
 await th('campaigns',undefined,staffSession.accessToken,403,{'x-thesi-workspace-id':second.workspaceId});
 await th(`campaigns/${staffCampaign.id}/pay-platform-fee`,{},staffSession.accessToken,403);
 assert.equal((await pg.query("SELECT actor_user_id FROM thesi.merchant_workspace_audit WHERE controller='CampaignsController' AND handler='create'")).rows[0].actor_user_id,staffSession.user.id);
 const dummy=await th('merchant-login/begin',{state:'s'.repeat(43),challenge:hash('v'.repeat(43))});
 await vendor('thesi/signin/authorize',{requestId:new URLSearchParams(new URL(dummy.url).hash.slice(1)).get('requestId'),brandId:brandB.id},staffToken,403);
 await catalog.query("UPDATE catalog.staff_grant SET ended_at=now() WHERE staff_user_id=$1 AND scope='thesi:write' AND ended_at IS NULL",[employee.id]);
 assert.equal((await th('brand-workspaces',undefined,staffSession.accessToken,200))[0].role,'viewer');
 await th('campaigns',draft,staffSession.accessToken,403);
 assert.equal((await th('campaigns',undefined,staffSession.accessToken,200)).campaigns.length,1);
 const refreshed=await th('auth/refresh',{refreshToken:first.refreshToken},undefined,200);
 assert.equal(jwt.verify(refreshed.accessToken).merchantSessionId,jwt.verify(first.accessToken).merchantSessionId);
 await th('auth/refresh',{refreshToken:first.refreshToken},undefined,401);
 await staff.setStatus(employee.id,'disabled');
 await th('brand-workspaces',undefined,staffSession.accessToken,401);
 await th('auth/refresh',{refreshToken:staffSession.refreshToken},undefined,401);
 await vendor('thesi/signin/logout',{},ownerToken);
 await th('brand-workspaces',undefined,refreshed.accessToken,401);
 await th('brand-workspaces',undefined,second.accessToken,401);
 const fresh=await th('merchant-login/finish',await handoff(ownerToken,brandA.id));
 await pg.query('UPDATE thesi.merchant_brand_link SET revoked_at=now() WHERE workspace_id=$1',[fresh.workspaceId]);
 await th('brand-workspaces',undefined,fresh.accessToken,401);
 console.log('PASS: connected Nest HTTP + Docker PostgreSQL: dedicated-key guards, DTO rejection, browser proof, replay, single first workspace, two brands, distinct staff, brand restriction, live downgrade/disable, refresh replay/provenance, Merchant logout and link revocation.');
}finally{
 for(const app of apps.reverse())await app.close();
 for(const pool of pools)await pool.end();
 for(const name of names)await admin.query(`DROP DATABASE IF EXISTS ${name}`);
 await admin.end();
}
