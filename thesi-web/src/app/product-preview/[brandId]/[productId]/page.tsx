import { backendApiUrl } from "@/lib/backendApi";
import { ProductPreviewView, type PreviewProduct } from "../../ProductPreviewView";
export const dynamic = "force-dynamic";
export const metadata = { title: "Product preview | Thesi" };
export default async function ProductPage({ params }: { params: Promise<{ brandId: string; productId: string }> }) {
  const { brandId, productId } = await params;
  let product: PreviewProduct | null = null;
  if ([brandId, productId].every(id => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))) {
    try {
      const response = await fetch(backendApiUrl(`/product-preview/${brandId}/${productId}`), { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000) });
      if (response.ok) product = (await response.json()).data;
    } catch { /* Show an unavailable state rather than stale product data. */ }
  }
  if (!product) return <main style={{ padding: "80px 24px", maxWidth: 680, margin: "auto" }}><h1>Product preview unavailable</h1><p>This product may no longer be available, or the Merchant catalog may be temporarily offline. Please try again later.</p><a href="/app">Return to Thesi</a></main>;
  return <ProductPreviewView product={product} />;
}
