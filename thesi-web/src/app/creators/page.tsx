import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CreatorHero } from "@/components/creators/CreatorHero";
import { CreatorAbout } from "@/components/creators/CreatorAbout";
import { CreatorWhoFor } from "@/components/creators/CreatorWhoFor";
import { CreatorBenefits } from "@/components/creators/CreatorBenefits";

export const metadata: Metadata = {
  title: "Thesi Creator Community — Run Your UGC Business",
  description:
    "Join Thesi. Manage your UGC business with CRM, campaigns, invoices, and marketplace tools built for creators.",
};

export default function CreatorsPage() {
  return (
    <div className="creator-page">
      <Header />
      <main>
        <CreatorHero />
        <CreatorAbout />
        <CreatorWhoFor />
        <CreatorBenefits />
        <section className="creator-cta-section">
          <h2>Ready to join?</h2>
          <p>We&apos;re selecting founding creators. Applications take under 3 minutes.</p>
          <Link href="/creators/apply" className="creator-btn-primary">
            Apply Now
          </Link>
        </section>
      </main>
      <Footer />
    </div>
  );
}
