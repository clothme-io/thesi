"use client";
import { useState } from "react";
import type { PromotedProduct } from "@/lib/brand-campaigns/types";
import { CreatorTrackingLink } from "./CreatorTrackingLink";
export function PromotedProductDetails({
  product,
  trackingCampaignId,
}: {
  product?: PromotedProduct;
  trackingCampaignId?: string;
}) {
  const [message, setMessage] = useState("");
  if (!product) return null;
  // Construct the local preview route from identity, never render an arbitrary stored URL.
  const path = `/product-preview/${encodeURIComponent(product.brandId)}/${encodeURIComponent(product.productId)}`;
  return <section className="workspace-section" style={{ marginBottom: 24 }}>
    <h3>Product to promote</h3>
    <p className="workspace-hint">{product.brandName}</p>
    <h4>{product.title}</h4>
    {product.imageUrl && <img src={product.imageUrl} alt={product.title} referrerPolicy="no-referrer" style={{ width: 160, height: 160, objectFit: "contain", borderRadius: 12 }} />}
    <p style={{ whiteSpace: "pre-wrap" }}>{product.description}</p>
    {product.variants&&<><p>Eligible variants and listed prices when agreed:</p><ul>{product.variants.map(v=><li key={v.id}>{v.color} / {v.size} — {new Intl.NumberFormat('en-US',{style:'currency',currency:v.currency}).format(v.priceCents/100)}</li>)}</ul><p>Actual checkout prices may change. Commission applies to the qualifying sale amount.</p></>}
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <a href={path} target="_blank" rel="noopener noreferrer" className="crm-btn-secondary">View product demo</a>
      <button type="button" className="crm-btn-secondary" onClick={async () => {
        try { await navigator.clipboard.writeText(new URL(path, window.location.origin).toString()); setMessage("Demo link copied"); }
        catch { setMessage("Could not copy. Open the demo and copy its address."); }
      }}>Copy demo link</button>
    </div>
    <p className="workspace-hint">Demo product preview. This link does not track sales or earn commission.</p>
    {message && <p role="status">{message}</p>}
    {trackingCampaignId && process.env.NEXT_PUBLIC_CREATOR_TRACKING_ENABLED === "true" && (
      <CreatorTrackingLink campaignId={trackingCampaignId} productId={product.productId} productTitle={product.title} />
    )}
  </section>;
}
