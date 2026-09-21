"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { EmailSignInForm } from "@/components/auth/EmailSignInForm";
import { GuestGuard } from "@/components/auth/GuestGuard";
import { MerchantHubBrandSignIn } from "@/components/auth/MerchantHubBrandSignIn";

export default function BrandSignInPage() {
  const [merchantError, setMerchantError] = useState("");

  return (
    <GuestGuard>
      <AuthLayout
        title="Brand sign in"
        subtitle="Open your brand workspace, manage campaigns, or continue with Merchant Hub."
      >
        {merchantError && (
          <p className="auth-error" role="alert">
            {merchantError}
          </p>
        )}
        <MerchantHubBrandSignIn onError={setMerchantError} />
        <EmailSignInForm
          submitLabel="Brand sign in"
          footer={
            <>
              <p className="auth-footer-text">
                Need a brand account?{" "}
                <Link href="/sign-up" className="auth-link">
                  Create one
                </Link>
              </p>
              <p className="auth-footer-text auth-footer-text--compact">
                Creator?{" "}
                <Link href="/creator/sign-in" className="auth-link">
                  Sign in as a creator
                </Link>
              </p>
            </>
          }
        />
      </AuthLayout>
    </GuestGuard>
  );
}
