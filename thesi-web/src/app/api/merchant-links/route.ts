import { NextResponse } from 'next/server';
import { backendApiUrl, getBackendBaseUrl } from '@/lib/backendApi';
export async function GET(request: Request) {
  if (!getBackendBaseUrl()) return NextResponse.json({ error: { message: 'Merchant linking is unavailable' } }, { status: 503 });
  try {
    const authorization = request.headers.get('authorization');
    const response = await fetch(backendApiUrl('/merchant-links'), { cache: 'no-store', headers: { ...(authorization ? { Authorization: authorization } : {}) } });
    return NextResponse.json(await response.json(), { status: response.status, headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: { message: 'Could not load Merchant connections' } }, { status: 502 }); }
}
