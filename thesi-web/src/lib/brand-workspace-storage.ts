import { getStoredSession } from './auth-storage';

export const WORKSPACE_HEADER = 'X-Thesi-Workspace-Id';
const key = (userId: string) => `thesi_workspace:${userId}`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function selectedWorkspace(userId: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const selected = sessionStorage.getItem(key(userId)) || undefined;
  if (selected && !uuid.test(selected)) throw new Error('Invalid saved brand. Choose a brand to continue.');
  return selected;
}
export function selectWorkspace(userId: string, workspaceId: string) {
  if (!uuid.test(workspaceId)) throw new Error('Invalid brand workspace');
  sessionStorage.setItem(key(userId), workspaceId);
}
export function workspaceForRequest(
  path: string,
  user: { id: string; role: string },
  method: string = 'GET',
): string | undefined {
  if (user.role !== 'brand') return undefined;
  if (!/^\/api\/(commission-settlement|campaign-funding|commission-earnings|campaigns|marketplace|profile|inbox|creators|billing|invites\/campaign)(\/|\?|$)/.test(path)) return undefined;
  const selected = selectedWorkspace(user.id);
  if (!selected && !['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase())) {
    throw new Error('Choose a brand before saving changes.');
  }
  return selected;
}
export function brandStorageKey(base: string): string {
  const session = getStoredSession();
  return session?.user.role === 'brand' ? `${base}:${session.user.id}:${selectedWorkspace(session.user.id) || 'default'}` : base;
}
