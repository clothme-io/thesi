import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingContrast } from "@/components/landing/LandingContrast";
import { LandingEcosystem } from "@/components/landing/LandingEcosystem";
import { LandingWhatCreatorsGet } from "@/components/landing/LandingWhatCreatorsGet";
import { LandingPhilosophy } from "@/components/landing/LandingPhilosophy";
import { LandingPlatform } from "@/components/landing/LandingPlatform";
import { LandingCurated } from "@/components/landing/LandingCurated";
import { LandingFinalCta } from "@/components/landing/LandingFinalCta";

export const metadata: Metadata = {
  title: "Thesi — Creator community for ClothME UGC creators",
  description:
    "Thesi helps ClothME UGC creators grow with authentic campaigns, a creator dashboard, CRM, invoices, and payouts — not just one-off posts.",
};

export default function HomePage() {
  return (
    <div className="creator-page">
      <Header />
      <main className="thesi-landing">
        <LandingHero />
        <LandingContrast />
        <LandingEcosystem />
        <LandingWhatCreatorsGet />
        <LandingPhilosophy />
        <LandingPlatform />
        <LandingCurated />
        <LandingFinalCta />
      </main>
      <Footer />
    </div>
  );
}
