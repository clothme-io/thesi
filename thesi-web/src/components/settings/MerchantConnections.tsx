'use client';
import { useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
type Connection = { id: string; vendorName: string; merchantBrandName: string; workspaceName: string };
export function MerchantConnections() {
  const { authenticatedRequest } = useAuth();
  const [links, setLinks] = useState<Connection[]>([]);
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    authenticatedRequest<Connection[]>('/api/merchant-links').then(rows => { if (active) setLinks(rows); })
      .catch(failure => { if (active) setError(failure instanceof Error ? failure.message : 'Could not load connections'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, [authenticatedRequest]);
  return <>
    <header className="app-topbar"><div><h1>Merchant Hub connections</h1><p>Connect brands from Merchant Hub’s integration settings.</p></div></header>
    <div className="app-content">
      {error && <p className="auth-error" role="alert">{error}</p>}
      {!ready && <p>Loading connections…</p>}
      {ready && !error && links.length === 0 && <p>No Merchant Hub brands are connected.</p>}
      {links.map(link => <section key={link.id} className="crm-brand-card">
        <h2>{link.workspaceName}</h2><p>{link.vendorName} · {link.merchantBrandName}</p>
        {confirm === link.id ? <>
          <p>Disconnect this Merchant brand? Existing campaigns, accounts and payment terms will remain.</p>
          <button type="button" disabled={busy} onClick={async () => {
            setBusy(true); setError('');
            try { await authenticatedRequest(`/api/merchant-links/${link.id}/revoke`, { method: 'POST' }); setLinks(rows => rows.filter(row => row.id !== link.id)); setConfirm(''); }
            catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not disconnect'); }
            finally { setBusy(false); }
          }}>Confirm disconnect</button>
          <button type="button" disabled={busy} onClick={() => setConfirm('')}>Cancel</button>
        </> : <button type="button" onClick={() => setConfirm(link.id)}>Disconnect</button>}
      </section>)}
    </div>
  </>;
}
