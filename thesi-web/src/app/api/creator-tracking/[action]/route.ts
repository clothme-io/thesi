import { NextResponse } from 'next/server';
import { backendApiUrl } from '@/lib/backendApi';
async function proxy(request: Request, context: { params: Promise<{ action: string }> }) {
  const { action } = await context.params;
  if (!['links','click'].includes(action) || (request.method === 'GET' && action !== 'links')) return NextResponse.json({ error:{ message:'Not found' } },{ status:404 });
  try {
    const authorization = request.headers.get('authorization');
    const response = await fetch(backendApiUrl(`/creator-tracking/${action}`), {
      method:request.method,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/json',...(action === 'links' && authorization ? { Authorization:authorization } : {})},
      ...(request.method === 'POST' ? { body:await request.text() } : {}),
    });
    return NextResponse.json(await response.json(),{status:response.status,headers:{'Cache-Control':'no-store'}});
  } catch { return NextResponse.json({ error:{message:'Creator links are temporarily unavailable. Please retry.'} },{status:502}); }
}
export const POST = proxy;
export const GET = proxy;
