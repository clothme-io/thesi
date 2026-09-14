import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const require=createRequire('/Applications/ChatGPT.app/Contents/Resources/cua_node/package.json');
const {chromium}=require('./lib/node_modules/playwright');
const browser=await chromium.launch({headless:false,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1380,height:1000}});
await page.route('**/*',route=>{
  const url=new URL(route.request().url());
  return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();
});
const output='/private/tmp/thesi-phase6/browser';mkdirSync(output,{recursive:true});
try {
  await page.goto('http://127.0.0.1:3016/local-creator-demo');
  await page.getByRole('button',{name:'Sign in as demo shopper'}).waitFor({timeout:120000});
  const open=await page.getByRole('link',{name:'Open ClothME'}).getAttribute('href');assert.match(open,/^clothme:\/\/creator-campaign\/[A-Za-z0-9_-]{43}$/);
  await page.screenshot({path:`${output}/before-login.png`,fullPage:true});
  await page.getByRole('button',{name:'Sign in as demo shopper'}).click();
  await page.getByRole('button',{name:'Continue to product'}).waitFor();
  await page.reload();
  await page.getByRole('button',{name:'Continue to product'}).click();
  await page.getByRole('button',{name:'Place unpaid demo order'}).click();
  await page.getByText('Unpaid demo order created',{exact:true}).waitFor();
  assert.match(await page.locator('main').innerText(),/Creator: creator/);
  assert.match(await page.locator('main').innerText(),/Payments captured: 0/);
  assert.match(await page.locator('main').innerText(),/Commission earned: \$0.00/);
  await page.screenshot({path:`${output}/attributed-order.png`,fullPage:true});
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false);
  await page.screenshot({path:`${output}/mobile-order.png`,fullPage:true});
  await page.setViewportSize({width:1380,height:1000});
  console.log('PASS: visible creator product, durable app link, fixture sign-in across reload, real Docker attribution and pending order, zero payment, mobile layout.');
  if(process.argv.includes('--keep-open'))await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
} finally {await browser.close();}
