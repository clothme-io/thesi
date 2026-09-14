import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
const dir=path.resolve(import.meta.dirname,'../thesi-web');process.chdir(dir);
Object.assign(process.env,{THESI_LOCAL_CREATOR_DEMO:'true',NEXT_TELEMETRY_DISABLED:'1',CLOTHME_DURABLE_CREATOR_LINKS_ENABLED:'true'});
const require=createRequire(path.join(dir,'package.json'));const next=require('next');
const app=next({dev:true,dir,hostname:'127.0.0.1',port:3016,conf:{distDir:'.next-creator-demo'}});
await app.prepare();http.createServer(app.getRequestHandler()).listen(3016,'127.0.0.1',()=>console.log('Creator purchase demo: http://127.0.0.1:3016/local-creator-demo'));
