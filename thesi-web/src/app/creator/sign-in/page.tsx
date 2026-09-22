import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailSignInForm } from "@/components/auth/EmailSignInForm";
import { GuestGuard } from "@/components/auth/GuestGuard";

export default function CreatorSignInPage() {
  return (
    <GuestGuard>
      <AuthLayout
        title="Creator sign in"
        subtitle="Open campaign invites, submit work, and manage your creator profile."
      >
        <EmailSignInForm
          submitLabel="Creator sign in"
          footer={
            <>
              <p className="auth-footer-text">
                New creator?{" "}
                <Link href="/creators/apply" className="auth-link">
                  Apply here
                </Link>
              </p>
              <p className="auth-footer-text auth-footer-text--compact">
                Brand?{" "}
                <Link href="/brand/sign-in" className="auth-link">
                  Sign in as a brand
                </Link>
              </p>
            </>
          }
        />
      </AuthLayout>
    </GuestGuard>
  );
}
