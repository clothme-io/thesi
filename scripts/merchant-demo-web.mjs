// Isolated Next dev cache so the existing local payment walkthrough can stay open.
// Usage: node scripts/merchant-demo-web.mjs thesi|merchant
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const merchant=process.argv[2]==='merchant';
const dir=merchant?path.resolve(root,'../fashion-merchants-hub'):path.join(root,'thesi-web');
process.chdir(dir);
Object.assign(process.env,merchant?{NEXT_PUBLIC_API_URL:'http://127.0.0.1:5031',NEXT_PUBLIC_THESI_SSO_ENABLED:'true',NEXT_PUBLIC_THESI_LINKING_ENABLED:'true'}:{THESI_API_URL:'http://127.0.0.1:5013',NEXT_PUBLIC_API_URL:'http://127.0.0.1:5013',NEXT_PUBLIC_MERCHANT_SSO_ENABLED:'true',NEXT_PUBLIC_BRAND_WORKSPACES_ENABLED:'true',NEXT_PUBLIC_AUTH_DEV_MODE:'false'});
if(process.argv.includes('--products'))Object.assign(process.env,{NEXT_PUBLIC_CAMPAIGN_PRODUCTS_ENABLED:'true',NEXT_PUBLIC_CAMPAIGN_MULTI_PRODUCTS_ENABLED:'true'});
if(process.argv.includes('--rules'))process.env.NEXT_PUBLIC_COMMISSION_RULES_ENABLED='true';
process.env.NEXT_TELEMETRY_DISABLED='1';
const require=createRequire(path.join(dir,'package.json')),next=require('next');
const app=next({dev:true,dir,hostname:'127.0.0.1',port:merchant?3040:3013,conf:{distDir:'.next-merchant-identity'}});
await app.prepare();
http.createServer(app.getRequestHandler()).listen(merchant?3040:3013,'127.0.0.1',()=>console.log(`Local ${merchant?'Merchant Hub':'Thesi'} identity UI: http://127.0.0.1:${merchant?3040:3013}`));
