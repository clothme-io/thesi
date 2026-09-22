"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { getPostAuthPath } from "@/lib/auth-storage";

type EmailSignInFormProps = {
  submitLabel?: string;
  footer?: React.ReactNode;
};

export function EmailSignInForm({
  submitLabel = "Sign in",
  footer,
}: EmailSignInFormProps) {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
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
          onChange={(event) => setEmail(event.target.value)}
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
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Enter your password"
          autoComplete="current-password"
          required
        />
      </div>

      <button type="submit" className="auth-submit" disabled={loading}>
        {loading ? "Signing in..." : submitLabel}
      </button>

      {footer}
    </form>
  );
}
