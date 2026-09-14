import { NextResponse } from 'next/server';
import { backendApiUrl, getBackendBaseUrl } from '@/lib/backendApi';

async function proxy(request: Request) {
  if (!getBackendBaseUrl()) return NextResponse.json({ error: { message: 'Brand service is not configured.' } }, { status: 503 });
  try {
    const authorization = request.headers.get('authorization');
    const response = await fetch(backendApiUrl('/brand-workspaces'), {
      method: request.method,
      headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
      ...(request.method === 'POST' ? { body: await request.text() } : {}),
      cache: 'no-store',
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch { return NextResponse.json({ error: { message: 'Could not reach the brand service.' } }, { status: 502 }); }
}
export const GET = proxy;
export const POST = proxy;
