import type { ReactNode } from "react";
import Link from "next/link";
export type PreviewProduct = { title: string; description: string; imageUrl: string | null; brandName: string };
export function ProductPreviewView({ product, sample = false, creatorLink = false, action }: { product: PreviewProduct; sample?: boolean; creatorLink?: boolean; action?: ReactNode }) {
  return <main style={{ minHeight: "100vh", background: "#f7f5f0", color: "#292b24", padding: "32px clamp(20px, 6vw, 100px)", fontFamily: "Arial, sans-serif" }}>
    <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #d8d9ce", paddingBottom: 24, gap: 16 }}>
      <Link href="/" style={{ fontSize: 27, fontWeight: 700, color: "inherit", textDecoration: "none" }}>thesi<span style={{ color: "#637047" }}>.</span></Link>
      <span style={{ fontSize: 12, letterSpacing: 2 }}>CLOTHME · PRODUCT PREVIEW</span>
    </header>
    <div style={{ maxWidth: 1160, margin: "64px auto", display: "flex", flexWrap: "wrap", gap: 48, alignItems: "center" }}>
      <div style={{ flex: "1 1 320px", background: "#ebe9df", borderRadius: 20, minHeight: 380, display: "grid", placeItems: "center", overflow: "hidden" }}>
        {product.imageUrl ? <img src={product.imageUrl} alt={product.title} referrerPolicy="no-referrer" style={{ width: "100%", maxHeight: 580, objectFit: "contain" }} /> : sample ? <svg viewBox="0 0 500 520" role="img" aria-label="Illustration of a cream linen shirt" style={{ width: "100%", maxWidth: 500 }}>
          <ellipse cx="250" cy="462" rx="130" ry="15" fill="#d9d5c7" />
          <path d="M184 94 L139 115 L58 222 L114 267 L153 219 L145 431 Q250 455 355 431 L347 219 L386 267 L442 222 L361 115 L316 94 L281 116 L219 116Z" fill="#f8f4e7" stroke="#d4cbbb" strokeWidth="3" />
          <path d="M184 94 L219 116 L250 168 L213 148 L190 170Z M316 94 L281 116 L250 168 L287 148 L310 170Z" fill="#e5dece" stroke="#c9c0ad" strokeWidth="2" />
          <path d="M250 169V442 M267 191H324V249Q295 267 267 249Z" fill="none" stroke="#d4cbbb" strokeWidth="2" />
          {[196,241,286,331,376,421].map(y => <circle key={y} cx="250" cy={y} r="3" fill="#b8ac96" />)}
          <text x="250" y="500" textAnchor="middle" fill="#777768" fontSize="12">DEMO PRODUCT · ILLUSTRATION</text>
        </svg> : <p>Product image unavailable</p>}
      </div>
      <article style={{ flex: "1 1 300px", maxWidth: 480 }}>
        <p style={{ fontSize: 12, letterSpacing: 3, textTransform: "uppercase", color: "#66724e" }}>{product.brandName}</p>
        <h1 style={{ fontFamily: "Georgia, serif", fontWeight: 400, fontSize: "clamp(36px, 4vw, 56px)", lineHeight: 1.12, margin: "20px 0" }}>{product.title}</h1>
        <p style={{ lineHeight: 1.8, color: "#565b50", whiteSpace: "pre-wrap" }}>{product.description}</p>
        <div style={{ borderTop: "1px solid #d8d9ce", paddingTop: 24, marginTop: 32 }}>
          <strong>{creatorLink ? "Explore this creator’s product pick." : "Get to know the product you’ll promote."}</strong>
          <p style={{ fontSize: 14, lineHeight: 1.7, color: "#565b50" }}>{creatorLink ? 'This product was shared through a creator campaign. Continue below to open ClothME with creator attribution. No purchase occurs on this page.' : 'This is a demo product page. Purchasing is not available, and this link does not track sales or earn commission.'}</p>
          {sample && <p style={{ fontSize: 13 }}>Sample brand and product shown for demonstration only.</p>}
        </div>
        {action ?? <Link href="/app" style={{ display: "inline-block", background: "#39452f", color: "white", borderRadius: 6, textDecoration: "none", padding: "15px 24px", marginTop: 12 }}>Return to Thesi</Link>}
      </article>
    </div>
    <footer style={{ borderTop: "1px solid #d8d9ce", paddingTop: 24, fontSize: 12, color: "#707466" }}>A product preview from ClothME and Thesi.</footer>
  </main>;
}
