import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Thesi — UGC Business Platform",
  description:
    "Thesi helps UGC creators manage their business and helps brands run UGC campaigns.",
};

export default function HomePage() {
  return (
    <div className="creator-page">
      <Header />
      <main className="thesi-landing">
        <section className="thesi-landing-hero">
          <p className="eyebrow">ClothME Creator Community</p>
          <h1>The UGC business platform for creators and brands</h1>
          <p className="thesi-landing-sub">
            CRM, campaigns, marketplace, and invoicing — everything you need to run UGC at
            scale.
          </p>
          <div className="creator-hero-ctas">
            <Link href="/creators" className="creator-btn-primary">
              I&apos;m a Creator
            </Link>
            <Link href="/brands" className="creator-btn-ghost">
              I&apos;m a Brand
            </Link>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
