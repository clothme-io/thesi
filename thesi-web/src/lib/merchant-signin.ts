const key='thesi_merchant_signin';
const pattern=/^[A-Za-z0-9_-]{43}$/;
const encode=(bytes:Uint8Array)=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function merchantLoginRequest<T>(action:string,body:unknown,token?:string):Promise<T>{
 const response=await fetch(`/api/merchant-login/${action}`,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(body)});
 const result=await response.json();
 if(!response.ok)throw new Error(result.error?.message||result.message||'Merchant sign-in failed');
 return result.data;
}
export async function startMerchantSignin(){
 const state=encode(crypto.getRandomValues(new Uint8Array(32))),verifier=encode(crypto.getRandomValues(new Uint8Array(32)));
 const challenge=encode(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
 sessionStorage.setItem(key,JSON.stringify({state,verifier,expiresAt:Date.now()+600000}));
 const {url}=await merchantLoginRequest<{url:string}>('begin',{state,challenge});
 window.location.assign(url);
}
export function readMerchantSignin():{code:string;verifier:string}{
 const incoming=new URLSearchParams(window.location.hash.slice(1));
 window.history.replaceState(null,'',window.location.pathname);
 const saved=JSON.parse(sessionStorage.getItem(key)||'null');
 if(!saved||saved.expiresAt<=Date.now()||!pattern.test(saved.verifier))throw new Error('Start Merchant sign-in again in this browser');
 if(incoming.has('code')){
  if(incoming.get('state')!==saved.state||!pattern.test(incoming.get('code')||''))throw new Error('Merchant sign-in verification failed');
  saved.code=incoming.get('code');sessionStorage.setItem(key,JSON.stringify(saved));
 }
 if(!pattern.test(saved.code||''))throw new Error('Merchant authorization is missing');
 return {code:saved.code,verifier:saved.verifier};
}
export function clearMerchantSignin(){sessionStorage.removeItem(key);}
