import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CreatorForm } from "@/components/creators/CreatorForm";

export const metadata: Metadata = {
  title: "Apply — Thesi Creator Community",
  description: "Apply to join the Thesi creator community.",
};

export default function CreatorsApplyPage() {
  return (
    <div className="creator-apply-page">
      <Header />
      <main>
        <CreatorForm />
      </main>
      <Footer />
    </div>
  );
}
