import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Brands — Thesi UGC Campaign Platform",
  description: "Create UGC campaigns, invite creators, and manage payments on Thesi.",
};

export default function BrandsPage() {
  return (
    <div className="creator-page">
      <Header />
      <main>
        <section className="creator-hero">
          <div className="creator-hero-inner">
            <p className="eyebrow">For Brands</p>
            <h1>Run UGC campaigns with confidence</h1>
            <p className="creator-hero-sub">
              Create campaigns, invite creators, post to the marketplace, and manage payouts
            </p>
            <div className="creator-hero-ctas">
              <Link href="/sign-up" className="creator-btn-primary">
                Get Started
              </Link>
              <Link href="/sign-in" className="creator-btn-ghost">
                Sign In
              </Link>
            </div>
          </div>
        </section>
        <section className="creator-about">
          <div className="creator-section-inner">
            <p className="eyebrow">Campaign Management</p>
            <h2>Everything brands need</h2>
            <div className="creator-benefits-grid">
              <div className="creator-benefit-item">
                <span className="creator-benefit-icon">📋</span>
                <h3 className="creator-benefit-title">Campaign Builder</h3>
                <p className="creator-benefit-desc">
                  Set campaign dates, base payment, and optional milestone payments.
                </p>
              </div>
              <div className="creator-benefit-item">
                <span className="creator-benefit-icon">🎯</span>
                <h3 className="creator-benefit-title">Creator Invites</h3>
                <p className="creator-benefit-desc">
                  Invite UGC creators directly or discover talent on the marketplace.
                </p>
              </div>
              <div className="creator-benefit-item">
                <span className="creator-benefit-icon">💳</span>
                <h3 className="creator-benefit-title">Stripe Payments</h3>
                <p className="creator-benefit-desc">
                  Secure payouts to creators with transparent platform fees.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
