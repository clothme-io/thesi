import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from './AuthProvider';
import { createDevSession, storeSession } from '@/lib/auth-storage';
import { selectWorkspace, WORKSPACE_HEADER } from '@/lib/brand-workspace-storage';

const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const session = createDevSession({ email: 'owner@example.test', password: 'fixture' }, 'brand');
const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); storeSession(session); selectWorkspace(session.user.id, first); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('authenticated workspace transport', () => {
  it('retains the original target through token refresh, including a selection change during the request', async () => {
    const fetchMock = vi.fn().mockImplementationOnce(async () => {
      selectWorkspace(session.user.id, second);
      return Response.json({ error: { message: 'Expired' } }, { status: 401 });
    }).mockResolvedValueOnce(Response.json({ data: { ...session, accessToken: 'refreshed' } }))
      .mockResolvedValueOnce(Response.json({ data: { id: 'created' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.session).not.toBeNull());
    await act(async () => { await result.current.authenticatedRequest('/api/campaigns', { method: 'POST', body: { name: 'Campaign' } }); });
    expect(fetchMock.mock.calls.map(call => call[1].headers[WORKSPACE_HEADER])).toEqual([first, undefined, first]);
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer refreshed');
  });
  it('scopes multipart uploads and binary downloads and omits selection from discovery', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(Response.json({ data: {} }))
      .mockResolvedValueOnce(new Response('file', { headers: { 'content-disposition': 'attachment; filename="file.txt"' } }))
      .mockResolvedValueOnce(Response.json({ data: [] }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.session).not.toBeNull());
    const form = new FormData(); form.append('file', new Blob(['test']), 'file.txt');
    await act(async () => {
      await result.current.authenticatedRequest('/api/profile/brand/logo', { method: 'POST', body: form });
      await result.current.authenticatedBinaryRequest('/api/campaigns/id/files/file/download');
      await result.current.authenticatedRequest('/api/brand-workspaces');
    });
    expect(fetchMock.mock.calls.map(call => call[1].headers[WORKSPACE_HEADER])).toEqual([first, first, undefined]);
    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].body).toBe(form);
  });
});
