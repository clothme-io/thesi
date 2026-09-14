"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import type { PromotedProduct } from "@/lib/brand-campaigns/types";
import { PromotedProductDetails } from "./PromotedProductDetails";
type Props = { value: string | null; onChange: (id: string | null) => void; initial?: PromotedProduct; locked?: boolean };
export function MerchantProductSelector(props: Props) {
  if (props.locked) return <PromotedProductDetails product={props.initial} />;
  if (process.env.NEXT_PUBLIC_CAMPAIGN_PRODUCTS_ENABLED !== "true") return <PromotedProductDetails product={props.initial} />;
  return <Selector {...props} />;
}
function Selector({ value, onChange, initial }: Props) {
  const { authenticatedRequest } = useAuth();
  const [products, setProducts] = useState<PromotedProduct[]>([]);
  const [offset, setOffset] = useState(0);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true; setLoading(true); setError("");
    authenticatedRequest<{ enabled: boolean; products: PromotedProduct[]; nextOffset: number | null }>(`/api/campaigns/products?offset=${offset}`)
      .then(data => { if (active) { setEnabled(data.enabled); setProducts(prev => offset === 0 ? data.products : [...prev.filter(p => !data.products.some(n => n.productId === p.productId)), ...data.products]); setNextOffset(data.nextOffset); } })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Could not load Merchant products"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authenticatedRequest, offset, retry]);
  if (!enabled) return initial ? <PromotedProductDetails product={initial} /> : null;
  const selected = products.find(p => p.productId === value) ?? (initial?.productId === value ? initial : undefined);
  return <section className="workspace-section">
    <h3>Product to promote</h3>
    <p className="workspace-hint">Choose a published, in-stock product from the Merchant brand connected to this Thesi brand. Required when publishing Commission campaigns.</p>
    <label className="workspace-field"><span>Merchant product</span><select value={value ?? ""} onChange={e => onChange(e.target.value || null)} disabled={loading || !!error}>
      <option value="">Select a product</option>
      {value && !products.some(p => p.productId === value) && <option value={value}>{initial?.title ?? "Previously selected product"} — not in loaded results</option>}
      {products.map(p => <option key={p.productId} value={p.productId}>{p.title} — {p.brandName}</option>)}
    </select></label>
    {loading && <p role="status">Loading products…</p>}
    {error && <p role="alert">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></p>}
    {!loading && !error && !products.length && <p>No eligible products on this page. Publish an in-stock product in Merchant Hub.</p>}
    {nextOffset !== null && <button type="button" disabled={loading} onClick={() => setOffset(nextOffset)}>Load more products</button>}
    <p><a href="/app/settings/integrations">Manage Merchant connection</a></p>
    <PromotedProductDetails product={selected} />
  </section>;
}
