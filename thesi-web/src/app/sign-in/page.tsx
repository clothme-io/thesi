import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GuestGuard } from "@/components/auth/GuestGuard";

export default function SignInPage() {
  return (
    <GuestGuard>
      <AuthLayout
        title="Choose your sign-in"
        subtitle="Pick the workspace you want to open in Thesi."
        variant="wide"
      >
        <div className="auth-choice-grid">
          <section className="auth-choice-card">
            <div className="auth-choice-icon">UGC</div>
            <h2>Creator</h2>
            <p>Manage campaign invites, submit content, and track payouts.</p>
            <Link href="/creator/sign-in" className="auth-choice-primary">
              Creator sign in
            </Link>
            <Link href="/creators/apply" className="auth-choice-secondary">
              Apply as a creator
            </Link>
          </section>

          <section className="auth-choice-card">
            <div className="auth-choice-icon">BR</div>
            <h2>Brand</h2>
            <p>Create campaigns, invite creators, and connect products.</p>
            <Link href="/brand/sign-in" className="auth-choice-primary">
              Brand sign in
            </Link>
            <Link href="/sign-up" className="auth-choice-secondary">
              Create brand account
            </Link>
          </section>
        </div>
      </AuthLayout>
    </GuestGuard>
  );
}
