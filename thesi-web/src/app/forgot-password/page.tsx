"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GuestGuard } from "@/components/auth/GuestGuard";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Could not send reset email");
      }
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send reset email");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GuestGuard>
      <AuthLayout
        title="Reset your password"
        subtitle="Enter the email on your account and we will send a reset link if it exists."
      >
        {sent ? (
          <>
            <p className="auth-success" role="status">
              If an account exists for that email, we sent a reset link. Check
              your inbox and spam folder.
            </p>
            <Link
              href="/sign-in"
              className="auth-submit"
              style={{ display: "inline-block", textAlign: "center" }}
            >
              Back to sign in
            </Link>
          </>
        ) : (
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

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </button>

            <p className="auth-footer-text">
              Remembered it?{" "}
              <Link href="/sign-in" className="auth-link">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </AuthLayout>
    </GuestGuard>
  );
}
