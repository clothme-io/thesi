import { NextResponse } from 'next/server';
import { backendApiUrl, getBackendBaseUrl } from '@/lib/backendApi';
async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const allowed = request.method === 'POST' && ((path.length === 1 && ['intent','approve'].includes(path[0])) || (path.length === 2 && /^[0-9a-f-]{36}$/i.test(path[0]) && path[1] === 'revoke'));
  if (!allowed) return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 });
  if (!getBackendBaseUrl()) return NextResponse.json({ error: { message: 'Merchant linking is unavailable' } }, { status: 503 });
  try {
    const authorization = request.headers.get('authorization');
    const response = await fetch(backendApiUrl(`/merchant-links/${path.join('/')}`), {
      method: 'POST', cache: 'no-store', redirect: 'error',
      headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) }, body: await request.text(),
    });
    return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: { message: 'Could not reach Thesi. Check connection status before retrying.' } }, { status: 502 }); }
}
export const POST = proxy;
