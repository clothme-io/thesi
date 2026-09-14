'use client';
import { useEffect, useRef, useState } from 'react';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { useAuth } from '@/context/AuthProvider';
import { clearMerchantSignin, merchantLoginRequest, readMerchantSignin, startMerchantSignin } from '@/lib/merchant-signin';
import { selectWorkspace } from '@/lib/brand-workspace-storage';
import { getPostAuthPath } from '@/lib/auth-storage';
import type { AuthSession } from '@/lib/auth-types';
type Details={email:string;fullName:string;brandName:string;vendorName:string;permission:string;requiresAccountProof:boolean;linkedAccountId:string|null;linkedAccountEmail:string|null;connected:boolean;workspaceName:string|null};
export default function MerchantSignin(){
 const {session,signIn,signOut,updateSession,authenticatedRequest}=useAuth();
 const [proof,setProof]=useState<{code:string;verifier:string}|null>(null),[details,setDetails]=useState<Details|null>(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false),[password,setPassword]=useState(''),[email,setEmail]=useState('');
 const [workspaces,setWorkspaces]=useState<{id:string;name:string}[]>([]),[workspaceId,setWorkspaceId]=useState('');
 const [replaceLocalAccess,setReplaceLocalAccess]=useState(false);
 const started=useRef(false);
 useEffect(()=>{if(started.current)return;started.current=true;if(new URLSearchParams(window.location.search).get('start')==='1'){void startMerchantSignin().catch(e=>setError(e.message));return;}try{const p=readMerchantSignin();setProof(p);void merchantLoginRequest<Details>('inspect',p).then(d=>{setDetails(d);setEmail(d.email);}).catch(e=>setError(e.message));}catch(e){setError(e instanceof Error?e.message:'Start sign-in again');}},[]);
 useEffect(()=>{if(session?.user.role==='brand'&&!details?.connected)void authenticatedRequest<{id:string;name:string}[]>('/api/brand-workspaces').then(setWorkspaces).catch(()=>setWorkspaces([]));},[session?.user.id,session?.user.role,details?.connected,authenticatedRequest]);
 async function finish(){if(!proof)return;setBusy(true);setError('');try{
  const result=await merchantLoginRequest<AuthSession&{workspaceId:string}>('finish',{...proof,consent:true,...(workspaceId?{workspaceId,replaceLocalAccess}:{})},session?.accessToken);
  updateSession(result);selectWorkspace(result.user.id,result.workspaceId);clearMerchantSignin();window.location.assign(getPostAuthPath(result));
 }catch(e){setError(e instanceof Error?e.message:'Sign-in failed');}finally{setBusy(false);}}
 return <AuthLayout title="Continue with Merchant Hub" subtitle="Merchant Hub controls access to your connected brand.">
  {error&&<p role="alert" className="auth-error">{error}</p>}
  {details&&<>
   <p>Merchant account: <strong>{details.vendorName}</strong><br/>Brand: <strong>{details.brandName}</strong><br/>Signing in as: <strong>{details.fullName}</strong> ({details.email})</p>
   <p>Access: {details.permission==='member'?'Campaign management':details.permission==='viewer'?'Read only':'Brand owner'}. Staff cannot access billing or release payments.</p>
   {details.requiresAccountProof&&!session&&<form onSubmit={event=>{event.preventDefault();setBusy(true);void signIn({email,password}).catch(e=>setError(e.message)).finally(()=>{setBusy(false);setPassword('');});}}>
    <p>This email already has a Thesi account. Sign in to confirm it belongs to you.</p>
    <div className="auth-field"><label htmlFor="merchant-email">Thesi email</label><input id="merchant-email" type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></div>
    <div className="auth-field"><label htmlFor="merchant-password">Thesi password</label><input id="merchant-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required/></div>
    <button className="auth-submit" disabled={busy}>Verify existing account</button>
   </form>}
   {details.linkedAccountEmail&&<p>Linked Thesi account: <strong>{details.linkedAccountEmail}</strong>.</p>}
   {session&&<p>Current Thesi account: <strong>{session.user.email}</strong>. <button className="auth-link" disabled={busy} onClick={()=>{signOut();setWorkspaceId('');setError('');}}>Use a different Thesi account</button></p>}
   {session?.user.role==='creator'&&<p role="alert">Creator accounts cannot be converted to brand accounts. Use a Thesi brand account to continue.</p>}
   {!details.connected&&details.permission==='owner'&&<div className="auth-field"><label htmlFor="merchant-workspace">Thesi brand</label><select id="merchant-workspace" value={workspaceId} onChange={e=>{setWorkspaceId(e.target.value);setReplaceLocalAccess(false);}}><option value="">Create a new workspace for {details.brandName}</option>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><p>Connecting an existing workspace keeps its agreements and payment history. Merchant permissions will govern linked access.</p></div>}
   {details.connected&&<p>Open connected Thesi workspace: <strong>{details.workspaceName}</strong>.</p>}
   {!details.connected&&workspaceId&&<label><input type="checkbox" checked={replaceLocalAccess} onChange={e=>setReplaceLocalAccess(e.target.checked)}/> Replace existing local staff access for this workspace with permissions managed in Merchant Hub. Campaigns and payment history are preserved.</label>}
   <button className="auth-submit" disabled={busy||(details.requiresAccountProof&&!session)||session?.user.role==='creator'||!!(session&&details.linkedAccountId&&session.user.id!==details.linkedAccountId)} onClick={()=>void finish()}>{busy?'Please wait…':details.connected?'Confirm and open Thesi':'Confirm account and brand setup'}</button>
  </>}
  <button className="auth-link" disabled={busy} onClick={()=>void startMerchantSignin().catch(e=>setError(e.message))}>Start again in Merchant Hub</button>
 </AuthLayout>;
}
