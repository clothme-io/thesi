import assert from 'node:assert/strict';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
export async function verifyCreatorHandoffHttp({root,customer,customerRequire:require,id,code,fetch}) {
  const {Module,ValidationPipe}=require('@nestjs/common');const {NestFactory}=require('@nestjs/core');
  const load=file=>require(path.resolve(root,'../customer-api/dist',file));
  const {CreatorAttributionController}=load('modules/commerce/api/creator-attribution.controller');
  const {CreatorAttributionService}=load('modules/commerce/application/creator-attribution.service');
  const {ResolveCartPersonService}=load('modules/commerce/application/resolve-cart-person.service');
  const {JwtAccessTokenService}=load('modules/identity/infrastructure/jwt-access-token.service');
  const {TOKEN_VERIFIER}=load('modules/identity/domain/token.ports');
  const {ApiEnvelopeInterceptor}=load('platform/http/api-envelope.interceptor');
  const {DomainExceptionFilter}=load('platform/errors/domain-exception.filter');
  const {HttpExceptionEnvelopeFilter}=load('platform/http/http-exception.filter');
  const secret=randomBytes(32).toString('hex');
  const tokens=new JwtAccessTokenService({getOrThrow:()=>secret,get:()=> '15m'});
  const people=new ResolveCartPersonService({listByAccountId:async account=>account===id(10)?[{id:id(11)}]:[{id:id(12)}]});
  class App {}
  Module({controllers:[CreatorAttributionController],providers:[{provide:CreatorAttributionService,useValue:customer},{provide:ResolveCartPersonService,useValue:people},{provide:TOKEN_VERIFIER,useValue:tokens}]})(App);
  const app=await NestFactory.create(App,{logger:false});
  app.setGlobalPrefix('v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalInterceptors(new ApiEnvelopeInterceptor());app.useGlobalFilters(new DomainExceptionFilter(),new HttpExceptionEnvelopeFilter());
  await app.listen(0,'127.0.0.1');
  try {
    const base=await app.getUrl();const token=await tokens.issueAccessToken({accountId:id(10),personId:id(11)});
    const post=(action,body,auth=token,person=id(11))=>fetch(`${base}/v1/customer/creator-attribution/${action}`,{method:'POST',headers:{'Content-Type':'application/json',...(auth?{Authorization:`Bearer ${auth}`} : {}),'X-Person-Id':person},body:JSON.stringify(body)});
    assert.equal((await post('prepare',{code},'')).status,401);
    assert.equal((await post('prepare',{code},'bad-token')).status,401);
    assert.equal((await post('prepare',{code},token,id(12))).status,400);
    assert.equal((await post('prepare',{code,creatorId:'injected'})).status,400);
    assert.equal((await post('prepare',{code:'invalid'})).status,400);
    const prepared=await post('prepare',{code});assert.equal(prepared.status,201);const grant=(await prepared.json()).result.code;
    assert.match(grant,/^[A-Za-z0-9_-]{43}$/);
    const claimed=await post('claim',{code:grant});assert.equal(claimed.status,201);assert.equal((await claimed.json()).result.productId,id(3));
    assert.equal((await post('claim',{code:grant})).status,201);
    const other=await tokens.issueAccessToken({accountId:id(20),personId:id(12)});
    const foreign=await post('claim',{code:grant},other,id(12));assert.ok(foreign.status>=400);
    console.log('PASS: actual Customer HTTP controller/JWT guard, owned-person resolution, strict DTOs, prepare/claim response envelopes, retry and foreign-shopper denial.');
  } finally {await app.close();}
}
