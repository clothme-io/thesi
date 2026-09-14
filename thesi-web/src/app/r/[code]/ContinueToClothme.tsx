"use client";
import { useState } from 'react';
export function ContinueToClothme({ code, durable=false, stores={}, installLink }: { code:string;durable?:boolean;stores?:{ios?:string;android?:string};installLink?:string }) {
  const [busy,setBusy] = useState(false); const [deepLink,setDeepLink] = useState('');const [message,setMessage] = useState('');
  const [copied,setCopied]=useState(false);
  const original=`https://get-thesi.com/r/${code}`;
  return <section style={{padding:24,marginTop:20,border:'1px solid #d8d9ce',borderRadius:12,lineHeight:1.65}}>
    <h2 style={{fontSize:22,fontWeight:600,marginBottom:12}}>Continue in ClothME</h2>
    <p>{durable ? "Open ClothME, sign in and tap Continue to product to connect your visit to this creator. You can install or sign in before continuing." : "Opening the app connects this product visit to its creator. Sign in and continue within 15 minutes."} Purchasing requires the ClothME app; this website has no checkout.</p>
    <p style={{fontSize:14,color:"#565b50",marginTop:12,marginBottom:20}}>Attribution supports this creator’s campaign. Earnings depend on qualifying, verified purchases and the campaign terms.</p>
    {durable ? <p><a href={installLink??`clothme://creator-campaign/${code}`} style={{display:"inline-block",padding:"12px 18px",borderRadius:6,background:"#39452f",color:"white"}}>{installLink?'Open or install ClothME':'Open ClothME'}</a></p> : <button type="button" disabled={busy} style={{padding:"12px 18px",borderRadius:6,border:"1px solid #39452f",background:deepLink?"transparent":"#39452f",color:deepLink?"#39452f":"white",cursor:busy?"wait":"pointer",opacity:busy?0.65:1}} onClick={async () => {
      setBusy(true);setMessage('');
      try {
        const response = await fetch('/api/creator-tracking/click',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code})});const body = await response.json();
        if(!response.ok) throw new Error(body.error?.message ?? body.message ?? 'The creator link is unavailable.');
        if(!/^clothme:\/\/creator-link\/[A-Za-z0-9_-]{43}$/.test(body.data?.deepLink)) throw new Error('Could not open ClothME');
        setDeepLink(body.data.deepLink);
      } catch(e) {setMessage(e instanceof Error ? e.message : 'Please retry');} finally {setBusy(false);}
    }}>{busy ? 'Preparing app link…' : deepLink ? 'Create a fresh app link' : 'Prepare my app link'}</button>}
    {deepLink && <p style={{marginTop:14}}><a href={deepLink} style={{display:"inline-block",padding:"12px 18px",borderRadius:6,background:"#39452f",color:"white",textDecoration:"none"}}>Open ClothME</a></p>}
    <div style={{marginTop:20}}>
      <h3 style={{fontWeight:600}}>Don’t have ClothME yet?</h3>
      {stores.ios && <p><a href={stores.ios} rel="noopener noreferrer">Get ClothME for iPhone</a></p>}
      {stores.android && <p><a href={stores.android} rel="noopener noreferrer">Get ClothME for Android</a></p>}
      {!installLink&&!stores.ios&&!stores.android&&<p>App download links are not available yet. You can still view the product here.</p>}
      <p>Save this creator link. After installing ClothME, return to this page and open the app again.{durable?' You can also paste the original link into the app’s creator-link screen.':''}</p>
      <button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(original);setCopied(true);setMessage('');}catch{setMessage('Copy the link shown below.');}}}>{copied?'Creator link copied':'Copy original creator link'}</button>
      <p style={{overflowWrap:'anywhere',fontSize:13}}>{original}</p>
      {copied&&<p role="status">Original link copied. Reopen it after installation.</p>}
    </div>
    {message && <p role="alert">{message}</p>}
  </section>;
}
