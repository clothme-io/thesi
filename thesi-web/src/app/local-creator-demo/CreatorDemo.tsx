"use client";
import { useEffect,useState } from 'react';
import { ContinueToClothme } from '@/app/r/[code]/ContinueToClothme';
type Demo={code:string;product:{title:string;brandName:string;description:string};orders:number;payments:number};
type Order={orderId:string;status:string;creatorId:string;productId:string;brandId:string;amountCents:number;payments:number};
export function CreatorDemo() {
  const [demo,setDemo]=useState<Demo>();const [token,setToken]=useState('');const [grant,setGrant]=useState('');const [product,setProduct]=useState('');const [order,setOrder]=useState<Order>();const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const call=async(action:string,body?:object)=>{
    const response=await fetch(`/api/local-creator-demo/${action}`,{method:action==='state'?'GET':'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},...(action==='state'?{}:{body:JSON.stringify(body??{})})});
    const value=await response.json();if(!response.ok)throw Error(value.message??'Please retry');return value;
  };
  useEffect(()=>{setToken(sessionStorage.getItem('creator-demo-session')??'');call('state').then(setDemo).catch(e=>setError(e.message));},[]);
  const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:'Please retry');}finally{setBusy(false);}};
  const button={padding:'13px 20px',borderRadius:8,background:'#35462f',color:'white',border:0,cursor:'pointer',marginTop:14};
  return <main style={{minHeight:'100vh',background:'#f7f5ef',color:'#293123',padding:'40px clamp(20px,6vw,90px)',fontFamily:'Arial,sans-serif'}}>
    <p style={{fontSize:13,letterSpacing:2}}>THESI × CLOTHME · LOCAL DEMO</p>
    <h1 style={{fontFamily:'Georgia,serif',fontSize:42,fontWeight:400}}>From a creator’s link to an attributed order</h1>
    <p style={{maxWidth:800,lineHeight:1.7}}>This browser walkthrough uses disposable local databases and the actual attribution and order services. Sign-in is simulated. Orders remain unpaid; no card is charged and no commission is earned.</p>
    {demo&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(min(100%,320px),1fr))',gap:28,marginTop:32}}>
      <section style={{background:'white',borderRadius:16,padding:28}}>
        <p>{demo.product.brandName}</p><h2 style={{fontFamily:'Georgia,serif',fontSize:32}}>{demo.product.title}</h2><p>{demo.product.description}</p><p>Demo price: $50.00 · Blue / M</p>
        <ContinueToClothme code={demo.code} durable />
      </section>
      <section style={{background:'white',borderRadius:16,padding:28,lineHeight:1.7}}>
        <p style={{fontSize:12,letterSpacing:2}}>BROWSER PURCHASE FALLBACK · DEMO ONLY</p>
        <h2>Continue as a shopper</h2>
        {!token?<><p>Your creator link stays available while you sign in or install the app.</p><button disabled={busy} style={button} onClick={()=>run(async()=>{const result=await call('login');sessionStorage.setItem('creator-demo-session',result.token);setToken(result.token);})}>Sign in as demo shopper</button></>:<>
          <p>Signed in as demo shopper</p>
          {!product?<><p>Continue to associate this product visit with the creator. This does not place an order.</p><button disabled={busy} style={button} onClick={()=>run(async()=>{let code=grant;if(!code){code=(await call('prepare',{code:demo.code})).code;setGrant(code);}const result=await call('claim',{code});setProduct(result.productId);})}>Continue to product</button></>:!order?<><p role="status">Creator attribution verified. Your demo cart contains one shirt.</p><button disabled={busy} style={button} onClick={()=>run(async()=>{setOrder(await call('checkout'));})}>Place unpaid demo order</button></>:<>
            <h3 role="status">Unpaid demo order created</h3><p>Order: {order.orderId}</p><p>Status: {order.status}</p><p>Creator: {order.creatorId}</p><p style={{overflowWrap:'anywhere'}}>Product: {order.productId}<br/>Brand: {order.brandId}</p><p>Payments captured: {order.payments}<br/>Commission earned: $0.00</p>
          </>}
          <p><button disabled={busy} onClick={()=>run(async()=>{await call('logout');sessionStorage.removeItem('creator-demo-session');setToken('');setGrant('');setProduct('');setOrder(undefined);})}>Sign out</button></p>
        </>}
        {busy&&<p role="status">Working…</p>}{error&&<p role="alert" style={{color:'#a33228'}}>{error}</p>}
      </section>
    </div>}
    {!demo&&<p role={error?'alert':'status'}>{error||'Loading the local product…'}</p>}
  </main>;
}
