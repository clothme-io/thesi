import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Application Received — Thesi Creator Community",
};

export default function CreatorsSuccessPage() {
  return (
    <div className="creator-page page-white">
      <Header />
      <main className="creator-success">
        <div className="creator-success-inner">
          <div className="creator-success-check" aria-hidden="true">
            ✓
          </div>
          <h1>Application Received</h1>
          <p>Thank you for applying to join the Thesi creator community.</p>
          <p>
            Our team reviews every application. Selected creators will receive an invitation
            by email.
          </p>
          <Link href="/" className="creator-btn-primary">
            Back to Thesi
          </Link>
        </div>
      </main>
      <Footer />
    </div>
  );
}
