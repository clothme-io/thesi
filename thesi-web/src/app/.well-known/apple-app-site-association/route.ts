export const dynamic = 'force-dynamic';
export function GET() {
  const enabled = process.env.CLOTHME_IOS_APP_LINKS_ENABLED === 'true';
  return Response.json({ applinks: { apps: [], details: enabled ? [{
    appID: 'A765V39MA5.io.patheos.clothme', paths: ['/r/*'],
  }] : [] } }, { headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}
