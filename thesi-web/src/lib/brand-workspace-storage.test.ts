import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';
import { brandStorageKey, selectedWorkspace, selectWorkspace, workspaceForRequest, WORKSPACE_HEADER } from './brand-workspace-storage';
import { workspaceHeaders } from './workspace-proxy';

const first = '10000000-0000-4000-8000-000000000001';
const second = '10000000-0000-4000-8000-000000000002';
const user = { id: 'owner', role: 'brand' };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => vi.restoreAllMocks());

describe('brand selection boundaries', () => {
  it('scopes selection and cached profiles by signed-in account and selected brand', () => {
    localStorage.setItem('thesi_auth_session', JSON.stringify({ user }));
    selectWorkspace(user.id, first);
    const key = brandStorageKey('profile');
    selectWorkspace(user.id, second);
    expect(brandStorageKey('profile')).not.toBe(key);
    expect(selectedWorkspace('other')).toBeUndefined();
    localStorage.setItem('thesi_auth_session', JSON.stringify({ user: { ...user, id: 'other' } }));
    expect(brandStorageKey('profile')).not.toContain(first);
    expect(brandStorageKey('profile')).not.toContain(second);
  });
  it.each(['/api/campaigns', '/api/campaigns/id/files', '/api/marketplace/listings/id', '/api/profile/brand/logo', '/api/inbox', '/api/creators/id/favorite', '/api/billing', '/api/invites/campaign?campaignId=id'])('adds selection to %s', path => {
    selectWorkspace(user.id, second);
    expect(workspaceForRequest(path, user)).toBe(second);
  });
  it.each(['/api/brand-workspaces', '/api/auth/refresh', '/api/settings', '/api/creator-crm/brands', '/api/profile-images/brands/workspace/id', '/api/invites/platform-brand'])('keeps account/creator/public route %s outside selection', path => {
    selectWorkspace(user.id, second);
    expect(workspaceForRequest(path, user)).toBeUndefined();
  });
  it('never sends stale brand selection on creator requests', () => {
    selectWorkspace(user.id, second);
    expect(workspaceForRequest('/api/inbox', { ...user, role: 'creator' })).toBeUndefined();
  });
  it('fails instead of silently changing brands when selection is invalid or unreadable', () => {
    expect(() => selectWorkspace(user.id, 'bad')).toThrow();
    sessionStorage.setItem('thesi_workspace:owner', 'bad');
    expect(() => workspaceForRequest('/api/campaigns', user)).toThrow('Invalid saved brand');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage unavailable'); });
    expect(() => workspaceForRequest('/api/campaigns', user)).toThrow('Storage unavailable');
  });
  it('forwards the selected identifier to the backend without adding unrelated headers', () => {
    const request = new Request('http://localhost/api/campaigns', { headers: { [WORKSPACE_HEADER]: second, 'X-Untrusted': 'ignored' } });
    expect(workspaceHeaders(request)).toEqual({ [WORKSPACE_HEADER]: second });
    expect(workspaceHeaders(new Request('http://localhost/api/campaigns'))).toEqual({});
  });
});
