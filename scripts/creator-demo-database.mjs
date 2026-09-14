import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
// Fixed local Docker fixture only. Never reads a production database URL.
export async function creatorDemoDatabase() {
  const require=createRequire(new URL('../thesi-api/package.json',import.meta.url));
  const {Pool}=require('pg');
  const config={host:'127.0.0.1',port:5844,user:'demo',password:'demo-local-only',max:1};
  const admin=new Pool({...config,database:'postgres'});
  const name='phase6_'+randomUUID().replaceAll('-','');
  await admin.query(`CREATE DATABASE "${name}"`);
  const pool=new Pool({...config,database:name,max:4});
  const connectionErrors=[];
  pool.on('error',error=>connectionErrors.push(error.code??'unknown'));
  return {$pool:pool,query:(...args)=>pool.query(...args),exec:sql=>pool.query(sql),close:async()=>{
    await pool.end();await admin.query(`DROP DATABASE "${name}" WITH (FORCE)`);await admin.end();
    if(connectionErrors.length)throw Error(`Disposable database connection errors: ${connectionErrors.join(', ')}`);
  }};
}
