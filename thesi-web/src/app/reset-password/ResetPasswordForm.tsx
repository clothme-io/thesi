"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { GuestGuard } from "@/components/auth/GuestGuard";

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() ?? "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (!token) {
      setError("This reset link is missing a token. Request a new one.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword,
          confirmPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Could not reset password");
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <GuestGuard>
      <AuthLayout
        title="Choose a new password"
        subtitle="Pick a password you have not used on Thesi before."
      >
        {done ? (
          <>
            <p className="auth-success" role="status">
              Your password was updated. Sign in with your new password.
            </p>
            <Link
              href="/sign-in"
              className="auth-submit"
              style={{ display: "inline-block", textAlign: "center" }}
            >
              Sign in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}
            {!token && !error && (
              <p className="auth-error" role="alert">
                This reset link is invalid. Request a new one from the sign-in
                page.
              </p>
            )}

            <div className="auth-field">
              <label htmlFor="newPassword">New password</label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={!token}
              />
            </div>

            <div className="auth-field">
              <label htmlFor="confirmPassword">Confirm new password</label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
                disabled={!token}
              />
            </div>

            <button
              type="submit"
              className="auth-submit"
              disabled={loading || !token}
            >
              {loading ? "Saving…" : "Save new password"}
            </button>

            <p className="auth-footer-text">
              Need a new link?{" "}
              <Link href="/forgot-password" className="auth-link">
                Request reset
              </Link>
            </p>
          </form>
        )}
      </AuthLayout>
    </GuestGuard>
  );
}
