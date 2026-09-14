import { creatorInstallLink } from '@/lib/creator-install-link';
import { clothmeStoreLinks } from '@/lib/clothme-store-links';
import { backendApiUrl } from '@/lib/backendApi';
import { ProductPreviewView, type PreviewProduct } from '@/app/product-preview/ProductPreviewView';
import { ContinueToClothme } from './ContinueToClothme';
export const dynamic='force-dynamic';
export const metadata={ title:'Creator product link | Thesi',robots:{index:false,follow:false},referrer:'no-referrer' as const };
export default async function CreatorProductPage({params}:{params:Promise<{code:string}>}) {
  const {code}=await params;let product:PreviewProduct|null=null;
  if(/^[A-Za-z0-9_-]{43}$/.test(code)) {
    try {const response=await fetch(backendApiUrl(`/creator-tracking/preview/${code}`),{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(12000)});if(response.ok)product=(await response.json()).data;}catch{/* Unavailable page. */}
  }
  if(!product)return <main style={{padding:48}}><h1>Creator link unavailable</h1><p>The campaign or product may no longer be available. Please ask the creator for an active link.</p></main>;
  return <ProductPreviewView product={product} creatorLink action={<ContinueToClothme code={code} durable={process.env.CLOTHME_DURABLE_CREATOR_LINKS_ENABLED==='true'} stores={clothmeStoreLinks(process.env)} installLink={creatorInstallLink(code,process.env)} />} />;
}
