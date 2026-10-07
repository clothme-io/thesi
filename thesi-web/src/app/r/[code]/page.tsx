import { redirect } from 'next/navigation';
import { clothmeProductLink } from '@/lib/creator-install-link';
import { backendApiUrl } from '@/lib/backendApi';
export const dynamic='force-dynamic';
export const metadata={ title:'Creator product link | Thesi',robots:{index:false,follow:false},referrer:'no-referrer' as const };
export default async function CreatorProductPage({params}:{params:Promise<{code:string}>}) {
  const {code}=await params;
  if(/^[A-Za-z0-9_-]{43}$/.test(code)) {
    try {
      const response=await fetch(backendApiUrl(`/creator-tracking/preview/${code}`),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});
      if(response.ok){
        const product=(await response.json()).data as {productId?:string;shareUrl?:string};
        const destination=product.shareUrl||(product.productId?clothmeProductLink(product.productId,code,process.env):undefined);
        if(destination) redirect(destination);
      }
    } catch { /* Unavailable page. */ }
  }
  return <main style={{padding:48}}><h1>Creator link unavailable</h1><p>The campaign or product may no longer be available. Please ask the creator for an active link.</p></main>;
}
