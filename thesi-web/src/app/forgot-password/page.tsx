import type { Metadata } from "next";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const metadata: Metadata = {
  title: "Forgot password — Thesi",
};

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Reset your password"
      subtitle="Password reset will be available once account services are connected to production."
    >
      <p className="auth-card-sub" style={{ marginBottom: 0 }}>
        For now, contact support if you need help accessing your account.
      </p>
      <Link href="/sign-in" className="auth-submit" style={{ display: "inline-block", textAlign: "center", marginTop: 20 }}>
        Back to sign in
      </Link>
    </AuthLayout>
  );
}
