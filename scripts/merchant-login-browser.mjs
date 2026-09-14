// Invoked by test-merchant-login-http.mjs --browser with disposable real Merchant credentials.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
export async function runBrowser({owner,brand,token}){
 const {chromium}=require('/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright');
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false});
 const context=await browser.newContext();
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  return ['127.0.0.1','localhost'].includes(url.hostname)||['data:','blob:'].includes(url.protocol)?route.continue():route.abort();
 });
 const page=await context.newPage();page.setDefaultTimeout(90000);
 try{
  await page.goto('http://127.0.0.1:3013/merchant-signin?start=1');
  await page.waitForURL('http://127.0.0.1:3040/sign-in');
  const pending=await page.evaluate(()=>JSON.parse(sessionStorage.getItem('clothme_thesi_authorize')));
  assert.ok(pending?.requestId,'Unauthenticated Merchant redirect must preserve the handoff');
  // Existing authenticated Merchant session fixture, issued by the real vendor
  // token service. This does not simulate entering a password in Merchant Hub.
  await page.evaluate(({owner,brand,token})=>{
   localStorage.setItem('clothme_auth_state',JSON.stringify({isAuthenticated:true,currentUserId:owner.id,vendorId:owner.id,brandId:brand.id,accessToken:token,refreshToken:'local-browser-fixture',email:owner.email,firstName:owner.firstName,lastName:owner.lastName,actor:'owner',onboardingCompleted:true,isApproved:true,vendorType:'boutique',capabilities:{scanPickup:true,scanBarcode:true}}));localStorage.setItem('token',token);
  },{owner,brand,token});
  await page.goto('http://127.0.0.1:3040/app/settings/integrations/thesi/authorize');
  await page.getByRole('button',{name:'Authorize Thesi sign-in'}).click();
  await page.waitForURL('http://127.0.0.1:3013/merchant-signin**');
  await page.getByRole('button',{name:'Confirm account and brand setup'}).click();
  await page.waitForURL('http://127.0.0.1:3013/onboarding/welcome');
  const session=await page.evaluate(()=>JSON.parse(localStorage.getItem('thesi_auth_session')));
  assert.equal(session.user.email,owner.email);assert.equal(session.user.onboardingCompleted,false);assert.ok(session.refreshToken.startsWith('mh.'));
  assert.equal(new URL(page.url()).hash,'');
  await mkdir('/private/tmp/thesi-phase3/browser',{recursive:true});
  await page.screenshot({path:'/private/tmp/thesi-phase3/browser/merchant-onboarding.png',fullPage:true});
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.waitForURL('http://127.0.0.1:3013/onboarding/questions');
  for(const [i,answer] of ['2–5','0–1','Manage campaigns','<$1k','ClothME'].entries()){
   await page.getByRole('radio',{name:answer,exact:true}).check();
   await page.getByRole('button',{name:i===4?'Go to dashboard':'Next',exact:true}).click();
  }
  await page.waitForURL('http://127.0.0.1:3013/app/dashboard');
  const completed=await page.evaluate(()=>JSON.parse(localStorage.getItem('thesi_auth_session')));
  assert.equal(completed.user.onboardingCompleted,true);assert.ok(completed.refreshToken.startsWith('mh.'));
  console.log('PASS browser: real Thesi → Merchant logged-out redirect → preserved authorization → existing Merchant session consent → new passwordless Thesi account → required onboarding.');
 }catch(error){
  console.error('Browser failed at',page.url(),(await page.locator('body').innerText()).slice(0,1800));throw error;
 }finally{await browser.close();}
}
