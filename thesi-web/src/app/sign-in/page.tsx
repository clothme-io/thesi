"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GuestGuard } from "@/components/auth/GuestGuard";
import { useAuth } from "@/context/AuthProvider";
import { getPostAuthPath } from "@/lib/auth-storage";

export default function SignInPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const session = await signIn({ email, password });
      router.push(getPostAuthPath(session));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GuestGuard>
      <AuthLayout
        title="Sign in"
        subtitle="Welcome back. Enter the email and password sent with your invitation."
      >
        <form onSubmit={handleSubmit}>
          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <div className="auth-field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="auth-field">
            <div className="auth-row">
              <label htmlFor="password">Password</label>
              <Link href="/forgot-password" className="auth-link">
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </div>

          <button type="submit" className="auth-submit" disabled={loading}>
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <p className="auth-footer-text">
            Brand account?{" "}
            <Link href="/sign-up" className="auth-link">
              Create one
            </Link>
          </p>
        </form>
      </AuthLayout>
    </GuestGuard>
  );
}
