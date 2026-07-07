"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GuestGuard } from "@/components/auth/GuestGuard";
import { useAuth } from "@/context/AuthProvider";
import { getPostAuthPath } from "@/lib/auth-storage";

export default function SignUpPage() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await signUp({ fullName, companyName, email, password });
      router.push(getPostAuthPath(session));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GuestGuard>
      <AuthLayout
        title="Create a brand account"
        subtitle="Start creating UGC campaigns, inviting creators, and posting to the marketplace."
      >
        <form onSubmit={handleSubmit}>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <div className="auth-field">
            <label htmlFor="fullName">Your name</label>
            <input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Alex Morgan"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="companyName">Brand / company name</label>
            <input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Acme Fashion"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="email">Work email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="alex@brand.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Creating account…" : "Create account"}
          </button>

          <p className="auth-footer-text">
            Already have an account?{" "}
            <Link href="/sign-in" className="auth-link">
              Sign in
            </Link>
          </p>
        </form>
      </AuthLayout>
    </GuestGuard>
  );
}
