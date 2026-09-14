'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthProvider';
import { AuthLayout } from '@/components/auth/AuthLayout';
import { clearMerchantIntent, merchantReturnUrl, readMerchantIntent } from '@/lib/merchant-link-flow';
import { selectWorkspace } from '@/lib/brand-workspace-storage';

type Workspace = { id: string; name: string; isDefault: boolean; canCreate: boolean };
type Intent = { vendorName: string; brandName: string; action: 'link'|'open' };
export default function MerchantLinkPage() {
  const { session, isLoading, signIn, signUp, signOut, authenticatedRequest } = useAuth();
  const [code, setCode] = useState('');
  const [intent, setIntent] = useState<Intent | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [brandName, setBrandName] = useState('');
  const [newBrand, setNewBrand] = useState('');
  const creationKey = useRef<string | null>(null);
  useEffect(() => {
    try { setCode(readMerchantIntent()); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not read connection request'); }
  }, []);
  useEffect(() => {
    if (!code || session?.user.role !== 'brand') return;
    let active = true;
    setIntent(null); setWorkspaces([]); setSelected('');
    Promise.all([
      authenticatedRequest<Intent>('/api/merchant-links/intent', { method: 'POST', body: { code } }),
      authenticatedRequest<Workspace[]>('/api/brand-workspaces'),
    ]).then(([details, rows]) => {
      if (!active) return;
      setIntent(details); setWorkspaces(rows); setError('');
      // Require an explicit selection: do not silently connect the default brand.
    }).catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'Could not load connection request'); });
    return () => { active = false; };
  }, [code, session?.user.id, session?.user.role, authenticatedRequest]);
  const run = async (action: () => Promise<void>) => {
    if (busy) return; setBusy(true); setError('');
    try { await action(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Request failed'); }
    finally { setBusy(false); }
  };
  return <AuthLayout title="Connect Merchant Hub and Thesi" subtitle="Choose the Thesi brand for your Merchant Hub brand. Your accounts and payment methods stay separate.">
    {error && <p className="auth-error" role="alert">{error}</p>}
    {isLoading ? <p>Loading your session…</p> : !session ? <>
      <p>Sign in to your Thesi account, or create a brand account to continue.</p>
      <form onSubmit={event => { event.preventDefault(); void run(async () => {
        if (register) await signUp({ email, password, fullName: name, companyName: brandName });
        else await signIn({ email, password });
        setPassword('');
      }); }}>
        {register && <>
          <div className="auth-field"><label htmlFor="link-name">Your name</label><input id="link-name" required value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="auth-field"><label htmlFor="link-brand">Brand name</label><input id="link-brand" required value={brandName} onChange={e => setBrandName(e.target.value)} /></div>
        </>}
        <div className="auth-field"><label htmlFor="link-email">Thesi email</label><input id="link-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div className="auth-field"><label htmlFor="link-password">Thesi password</label><input id="link-password" type="password" autoComplete={register ? 'new-password' : 'current-password'} required minLength={register ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} /></div>
        <button className="auth-submit" disabled={busy || !code}>{busy ? 'Please wait…' : register ? 'Create Thesi account' : 'Sign in to Thesi'}</button>
      </form>
      <button className="auth-link" type="button" disabled={busy} onClick={() => setRegister(!register)}>{register ? 'Use an existing Thesi account' : 'Create a Thesi brand account'}</button>
      <p><Link href="/forgot-password">Forgot your password?</Link></p>
    </> : <>
      <p>Signed in as <strong>{session.user.email}</strong>.</p>
      <button className="auth-link" type="button" disabled={busy} onClick={() => { setIntent(null); setSelected(''); signOut(); }}>Use a different Thesi account</button>
      {session.user.role !== 'brand' && <p role="alert">A Thesi brand account is required. Your creator account will not be converted.</p>}
      {session.user.mustChangePassword && <p><Link href="/onboarding/change-password">Change your temporary password</Link>, then return here to continue.</p>}
      {intent && <>
        <p>Merchant account: <strong>{intent.vendorName}</strong><br />Merchant brand: <strong>{intent.brandName}</strong></p>
        {intent.action === 'link' && <>
          <div className="auth-field"><label htmlFor="link-workspace">Thesi brand to connect</label>
            <select id="link-workspace" value={selected} disabled={busy} onChange={e => setSelected(e.target.value)}>
              <option value="">Choose a brand</option>
              {workspaces.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
            </select>
          </div>
          <p>Merchant Hub will identify this brand for future product and campaign integrations. No sales tracking or billing is enabled by this connection.</p>
          {workspaces.some(row => row.canCreate) && <form onSubmit={event => { event.preventDefault(); void run(async () => {
            creationKey.current ??= crypto.randomUUID();
            const created = await authenticatedRequest<{ id: string; name: string }>('/api/brand-workspaces', { method: 'POST', body: { name: newBrand.trim(), creationKey: creationKey.current } });
            setWorkspaces(await authenticatedRequest<Workspace[]>('/api/brand-workspaces')); setSelected(created.id); setNewBrand(''); creationKey.current = null;
          }); }}>
            <div className="auth-field"><label htmlFor="new-thesi-brand">Or create another Thesi brand</label><input id="new-thesi-brand" maxLength={120} value={newBrand} disabled={busy} onChange={e => { setNewBrand(e.target.value); creationKey.current = null; }} /></div>
            <button type="submit" className="auth-link" disabled={busy || !newBrand.trim()}>Create brand</button>
          </form>}
        </>}
        <button type="button" className="auth-submit" disabled={busy || session.user.mustChangePassword || (intent.action === 'link' && !selected)} onClick={() => void run(async () => {
          const result = await authenticatedRequest<{ url?: string; workspaceId?: string }>('/api/merchant-links/approve', { method: 'POST', body: { code, ...(intent.action === 'link' ? { workspaceId: selected } : {}) } });
          if (result.workspaceId) { selectWorkspace(session.user.id, result.workspaceId); clearMerchantIntent(); window.location.assign('/app/dashboard'); }
          else if (result.url) { const url = merchantReturnUrl(result.url); clearMerchantIntent(); window.location.assign(url); }
          else throw new Error('Connection response was incomplete. Return to Merchant Hub.');
        })}>{busy ? 'Please wait…' : intent.action === 'open' ? 'Open connected brand' : 'Continue to Merchant Hub review'}</button>
      </>}
    </>}
  </AuthLayout>;
}
