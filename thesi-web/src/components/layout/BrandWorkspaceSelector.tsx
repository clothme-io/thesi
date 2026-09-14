'use client';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthProvider';
import { selectedWorkspace, selectWorkspace } from '@/lib/brand-workspace-storage';

type Workspace = { id: string; name: string; role: string; isDefault: boolean; canCreate: boolean };
export function BrandWorkspaceSelector() {
  const { session, authenticatedRequest } = useAuth();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selected, setSelected] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestKey = useRef<string | null>(null);
  useEffect(() => {
    if (session?.user.role !== 'brand') return;
    let current = true;
    authenticatedRequest<Workspace[]>('/api/brand-workspaces').then(rows => {
      if (!current) return;
      setWorkspaces(rows);
      const saved = selectedWorkspace(session.user.id);
      setSelected(saved || rows.find(row => row.isDefault)?.id || '');
      if (saved && !rows.some(row => row.id === saved)) setError('This brand is no longer available. Choose a brand to continue.');
    }).catch(() => { /* Discovery may be disabled. Never silently change brands. */ });
    return () => { current = false; };
  }, [authenticatedRequest, session?.user.id, session?.user.role]);
  if (session?.user.role !== 'brand' || workspaces.length === 0) return null;
  const open = (id: string) => {
    try { selectWorkspace(session.user.id, id); window.location.assign('/app/dashboard'); }
    catch { setError('Could not switch brands. Check browser storage access and try again.'); }
  };
  return <div className="brand-workspace-selector">
    <label htmlFor="active-brand">Brand</label>
    <select id="active-brand" aria-label="Active brand" value={selected} onChange={event => open(event.target.value)}>
      {!workspaces.some(row => row.id === selected) && <option value="">Choose a brand</option>}
      {workspaces.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}
    </select>
    {workspaces.some(row => row.canCreate) && !adding && <button type="button" onClick={() => { setAdding(true); requestKey.current = crypto.randomUUID(); }}>Add brand</button>}
    {adding && <form onSubmit={async event => {
      event.preventDefault(); if (busy) return; setBusy(true); setError('');
      try {
        const created = await authenticatedRequest<{ id: string }>('/api/brand-workspaces', { method: 'POST', body: { name: name.trim(), creationKey: requestKey.current } });
        open(created.id);
      } catch (failure) { setError(failure instanceof Error ? failure.message : 'Could not create brand.'); }
      finally { setBusy(false); }
    }}>
      <label htmlFor="new-brand-name">Brand name</label>
      <input id="new-brand-name" value={name} maxLength={120} required disabled={busy} onChange={event => { setName(event.target.value); requestKey.current = crypto.randomUUID(); }} />
      <button type="submit" disabled={busy || !name.trim()}>{busy ? 'Creating…' : 'Create brand'}</button>
      <button type="button" disabled={busy} onClick={() => { setAdding(false); setError(''); }}>Cancel</button>
    </form>}
    {error && <p role="alert">{error}</p>}
  </div>;
}
