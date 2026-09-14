// Runs actual pending-link store logic with in-memory native storage; no device/network/credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
const root=path.resolve(import.meta.dirname,'..');
const apiRequire=createRequire(path.join(root,'thesi-api/package.json'));
const mobileRequire=createRequire(path.resolve(root,'../clothme_client/package.json'));
const ts=apiRequire('typescript');const store=new Map();
const storage={getItem:async k=>store.get(k)??null,setItem:async(k,v)=>{store.set(k,v);},removeItem:async k=>{store.delete(k);}};
const source=fs.readFileSync(path.resolve(root,'../clothme_client/services/creator-attribution/pending.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
const sandbox={exports:{},require:name=>name==='@react-native-async-storage/async-storage'?storage:mobileRequire(name),Date,console};
vm.runInNewContext(compiled,sandbox);
const {validCreatorCode,freshCreatorCode,usePendingCreatorLink}=sandbox.exports;
assert.equal(validCreatorCode('a'.repeat(43)),true);for(const x of [null,['a'.repeat(43)],'../bad','a'.repeat(42)])assert.equal(validCreatorCode(x),false);
assert.equal(freshCreatorCode({receivedAt:1000},901000),false);assert.equal(freshCreatorCode({receivedAt:1000},999),false);assert.equal(freshCreatorCode({receivedAt:1000},1001),true);
await usePendingCreatorLink.persist.rehydrate();
usePendingCreatorLink.getState().capture('a'.repeat(43));const first=usePendingCreatorLink.getState().pending;
usePendingCreatorLink.getState().capture('a'.repeat(43));assert.equal(usePendingCreatorLink.getState().pending,first);
usePendingCreatorLink.getState().capture('invalid');assert.equal(usePendingCreatorLink.getState().pending,first);
usePendingCreatorLink.getState().clear();assert.equal(usePendingCreatorLink.getState().pending,null);
console.log('PASS: mobile handoff format, expiry, future-clock rejection, replay without time renewal, invalid capture and clearing.');

const load=(file,imports={})=>{
 const source=fs.readFileSync(path.resolve(root,'../clothme_client/services/creator-attribution',file),'utf8');
 const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const context={exports:{},require:name=>imports[name],URL,Date,console};vm.runInNewContext(compiled,context);return context.exports;
};
const {parseCreatorLink,creatorSystemPath}=load('links.ts');
const code='a'.repeat(43),other='b'.repeat(43);
for(const url of [`https://get-thesi.com/r/${code}`,`clothme://creator-campaign/${code}`]){assert.equal(parseCreatorLink(url).kind,'share');assert.equal(creatorSystemPath(url),`/creator-campaign/${code}`);}
assert.equal(parseCreatorLink(`clothme://creator-link/${code}`).kind,'grant');
for(const url of [`https://evil.test/r/${code}`,`http://get-thesi.com/r/${code}`,`https://get-thesi.com.evil.test/r/${code}`,`https://user@get-thesi.com/r/${code}`,`https://get-thesi.com/r/${code}?next=evil`,`clothme://creator-campaign/${code}#extra`,'garbage'])assert.equal(parseCreatorLink(url),null);
assert.equal(creatorSystemPath(`/r/${code}`),`/creator-campaign/${code}`);
assert.equal(creatorSystemPath('clothme://invite/existing'),'clothme://invite/existing');
assert.equal(freshCreatorCode({kind:'share',receivedAt:1000},1000+29*86400000),true);
assert.equal(freshCreatorCode({kind:'share',receivedAt:1000},1000+30*86400000),false);
const state=()=>usePendingCreatorLink.getState();
state().capture(code,'share');const publicLink=state().pending;state().capture(other,'share');state().clear(publicLink);assert.equal(state().pending.code,other);assert.equal(state().replaceGrant(publicLink,code),false);
const {continueCreatorLink}=load('continue.ts',{'./pending':sandbox.exports});
let account={id:'shopper',personId:'person',accessToken:'local'};
let prepared=0,claimed=0,shouldFail=true;
const input=()=>({pending:state().pending,account:{...account},currentAccount:()=>account,currentPending:()=>state().pending,replaceGrant:(p,c)=>state().replaceGrant(p,c),clear:p=>state().clear(p),prepare:async()=>{prepared++;return {code};},claim:async()=>{claimed++;if(shouldFail)throw Error('offline');return {productId:'00000001-1111-4111-8111-111111111111'};}});
await assert.rejects(continueCreatorLink(input()),/offline/);
assert.equal(state().pending.kind,'grant');assert.equal(prepared,1);
shouldFail=false;await continueCreatorLink(input());assert.equal(prepared,1);assert.equal(claimed,2);assert.equal(state().pending,null);
state().capture(other,'share');const switched=input();switched.prepare=async()=>{account={...account,personId:'different'};return {code};};await assert.rejects(continueCreatorLink(switched),/account changed/);assert.equal(state().pending.code,other);
const superseded=input();superseded.prepare=async()=>{state().capture(code,'share');return {code:other};};await assert.rejects(continueCreatorLink(superseded),/different creator link/);assert.equal(state().pending.code,code);
const cancelled=input();cancelled.claim=async()=>{state().clear();return {productId:'00000001-1111-4111-8111-111111111111'};};await assert.rejects(continueCreatorLink(cancelled),/different creator link/);
console.log('PASS: trusted URL/native routing, durable expiry, stale clear prevention, prepare/claim retry without renewal, account switch, superseded link and cancellation.');

async function hydrationRace(cancel) {
 let release;
 const delayed={...storage,getItem:()=>new Promise(resolve=>{release=resolve;})};
 const context={exports:{},require:name=>name==='@react-native-async-storage/async-storage'?delayed:mobileRequire(name),Date,console};
 vm.runInNewContext(compiled,context);
 const pendingStore=context.exports.usePendingCreatorLink;
 pendingStore.getState().capture(other,'share');
 if(cancel)pendingStore.getState().clear();
 release(JSON.stringify({state:{pending:{code,kind:'share',receivedAt:Date.now()}},version:0}));
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.equal(pendingStore.getState().hydrated,true);
 assert.equal(pendingStore.getState().pending?.code??null,cancel?null:other);
}
await hydrationRace(false);await hydrationRace(true);
console.log('PASS: cold-start storage hydration cannot replace a newly opened link or resurrect a cancelled link.');

let providerCallback;const delivered=[];
const providerSource=fs.readFileSync(path.resolve(root,'../clothme_client/services/deepLink/providers/AirbridgeProvider.ts'),'utf8');
const providerCompiled=ts.transpileModule(providerSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const providerContext={exports:{},URL,console,process:{env:{EXPO_PUBLIC_AIRBRIDGE_ENABLED:'true',EXPO_PUBLIC_AIRBRIDGE_APP_NAME:'local-test',EXPO_PUBLIC_AIRBRIDGE_APP_TOKEN:'local-test'}},require:name=>name==='airbridge-react-native-sdk'?{Airbridge:{setOnDeeplinkReceived:cb=>{providerCallback=cb;}}}: {parseCreatorLink}};
vm.runInNewContext(providerCompiled,providerContext);
await providerContext.exports.initDeepLinkProvider(link=>delivered.push(link));
providerCallback(`https://get-thesi.com/r/${code}`);assert.equal(delivered[0].type,'creator-campaign');
providerCallback(`https://evil.test/r/${code}`);assert.equal(delivered.length,1);
providerContext.exports.teardownDeepLinkProvider();providerCallback(`https://get-thesi.com/r/${other}`);assert.equal(delivered.length,1);
await providerContext.exports.initDeepLinkProvider(link=>delivered.push(link));providerCallback('clothme://invite/INV-123');assert.equal(delivered[1].type,'invite');
console.log('PASS: installed SDK listener contract, deferred public-code normalization, untrusted-host rejection, teardown and reinitialization.');

usePendingCreatorLink.setState({pending:{code,kind:'share',receivedAt:Date.now()-31*86400000}});
state().capture(code,'share');assert.equal(freshCreatorCode(state().pending),true);
usePendingCreatorLink.setState({pending:{code,kind:'grant',receivedAt:Date.now()-3600000}});
state().capture(code,'grant');assert.equal(freshCreatorCode(state().pending),false);
console.log('PASS: explicitly reopening an old public share refreshes local retention; expired grant replay never renews a handoff.');

const configSource=fs.readFileSync(path.resolve(root,'../clothme_client/app.config.js'),'utf8');
const configEnv={};const configContext={module:{exports:{}},process:{env:configEnv}};vm.runInNewContext(configSource,configContext);
const configure=configContext.module.exports;const originalConfig={name:'ClothME',plugins:['expo-router']};
assert.equal(configure({config:originalConfig}),originalConfig);
configEnv.EXPO_PUBLIC_AIRBRIDGE_ENABLED='true';assert.throws(()=>configure({config:originalConfig}),/requires/);
configEnv.EXPO_PUBLIC_AIRBRIDGE_APP_NAME='fixture';configEnv.EXPO_PUBLIC_AIRBRIDGE_APP_TOKEN='local-fixture-token';
const configured=configure({config:originalConfig});assert.equal(configured.plugins.at(-1)[0],'airbridge-expo-sdk');assert.equal(originalConfig.plugins.length,1);
console.log('PASS: native provider configuration is opt-in, requires credentials and preserves existing plugins.');

assert.equal(parseCreatorLink(`https://get-thesi.com/r/${code}?utm_source=instagram&fbclid=example`).code,code);
assert.equal(creatorSystemPath(`/r/${code}?utm_campaign=summer`),`/creator-campaign/${code}`);
console.log('PASS: social tracking parameters preserve the original creator code and are stripped from the native route.');
