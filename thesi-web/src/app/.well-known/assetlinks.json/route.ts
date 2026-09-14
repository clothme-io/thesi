import { androidAssetLinks } from '@/lib/android-app-links';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json(androidAssetLinks(process.env), {
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
}
