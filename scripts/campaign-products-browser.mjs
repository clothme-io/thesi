// Actual Thesi campaign editor against the disposable connected APIs.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
const require=createRequire(import.meta.url);
export async function runProductBrowser({session,pg}){
 await pg.query("UPDATE public.thesi_users SET onboarding_completed=true,onboarding_step='completed' WHERE id=$1",[session.user.id]);
 const {chromium}=require('/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/playwright');
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:false});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.route('**/*',route=>['127.0.0.1','localhost'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
 const page=await context.newPage();page.setDefaultTimeout(60000);
 try{
  await page.goto('http://127.0.0.1:3013/sign-in');
  await page.evaluate(session=>{localStorage.setItem('thesi_auth_session',JSON.stringify({...session,user:{...session.user,onboardingCompleted:true,onboardingStep:'completed'}}));sessionStorage.setItem(`thesi_workspace:${session.user.id}`,session.workspaceId);},session);
  await page.goto('http://127.0.0.1:3013/app/campaigns/new');
  await page.locator('[name="campaignName"]').fill('Browser multi-product commission');
  await page.getByTestId('campaign-payment-model-select').selectOption('commission');
  await page.getByRole('checkbox',{name:'Linen shirt — Demo Denim'}).check();
  await page.getByRole('checkbox',{name:'Denim trousers — Demo Denim'}).check();
  await page.getByRole('group',{name:'Linen shirt — Demo Denim'}).getByRole('checkbox',{name:'Blue / L — $35.00'}).uncheck();
  await page.getByRole('checkbox',{name:'Include a fixed base payment (optional)'}).uncheck();
  await page.locator('[name="commissionRate"]').fill('10');
  await page.locator('[name="commissionBasis"]').selectOption('percentage_of_sale');
  await page.locator('[name="commissionAttributionDays"]').fill('30');
  await page.locator('[name="commissionTerms"]').fill('Qualifying attributed sales after returns.');
  if(process.argv.includes('--rules')){
    assert.equal(await page.locator('[name=commissionReviewDays]').inputValue(),'30');
    await page.locator('[name=commissionReviewDays]').fill('45');
    await page.locator('[name=commissionPayoutFrequency]').selectOption('weekly');
  }
  const response=page.waitForResponse(r=>r.url().endsWith('/api/campaigns')&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Save draft',exact:true}).first().click();
  const r=await response;const body=await r.json();assert.equal(r.status(),201,JSON.stringify(body));
  const saved=body.data??body;
  if(process.argv.includes('--rules'))assert.deepEqual(saved.payment.hybrid.affiliate.rules,{version:1,reviewDays:45,payoutFrequency:'weekly',minimumPayoutCents:0,creatorFeeCents:0,creditPolicy:'hold_until_verified',selfReferralPolicy:'hold_until_reviewed'});
  assert.equal(saved.payment.promotedProducts.length,2);assert.equal(saved.payment.promotedProducts.find(p=>p.title==='Linen shirt').variants.length,1);
  assert.equal(saved.payment.promotedProducts.find(p=>p.title==='Linen shirt').variants[0].priceCents,9900);
  await page.getByText('Draft saved — Browser multi-product commission',{exact:true}).waitFor();
  await page.getByRole('heading',{name:'Products to promote'}).scrollIntoViewIfNeeded();
  await mkdir('/private/tmp/thesi-phase4/browser',{recursive:true});
  await page.screenshot({path:'/private/tmp/thesi-phase4/browser/products-selected.png'});
  if(process.argv.includes('--rules')){await page.getByText('Commission payout rules',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'/private/tmp/thesi-phase4/browser/commission-rules.png'});}
  await page.goto(`http://127.0.0.1:3013/app/campaigns/new?from=${saved.id}`);
  await page.getByRole('checkbox',{name:'Linen shirt — Demo Denim'}).waitFor();
  assert.equal(await page.getByRole('checkbox',{name:'Linen shirt — Demo Denim'}).isChecked(),true);
  assert.equal(await page.getByRole('checkbox',{name:'Denim trousers — Demo Denim'}).isChecked(),true);
  assert.equal(await page.getByRole('group',{name:'Linen shirt — Demo Denim'}).getByRole('checkbox',{name:'Blue / L — $35.00'}).isChecked(),false);
  if(process.argv.includes('--rules'))assert.equal(await page.locator('[name=commissionReviewDays]').inputValue(),'45');
  console.log('PASS browser: actual campaign creation, two catalog products, selected variants/current prices, optional base disabled, saved API agreement, duplication preserves selections.');
 }catch(e){console.error('Product browser failed at',page.url(),(await page.locator('body').innerText()).slice(-4000));throw e;}finally{await browser.close();}
}
