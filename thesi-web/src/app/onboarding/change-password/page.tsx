"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingGuard, getOnboardingProgress } from "@/components/auth/OnboardingGuard";
import { useAuth } from "@/context/AuthProvider";

export default function ChangePasswordPage() {
  const router = useRouter();
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
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

    setLoading(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      router.push("/onboarding/welcome");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <OnboardingGuard>
      <div className="onboarding-page">
        <div className="onboarding-card">
          <div className="onboarding-progress">
            <div
              className="onboarding-progress-bar"
              style={{ width: `${getOnboardingProgress("/onboarding/change-password")}%` }}
            />
          </div>
          <h1>Create your new password</h1>
          <p>
            For security, you must set a new password before continuing. This is required
            on your first sign-in.
          </p>

          <form onSubmit={handleSubmit}>
            {error && (
              <p className="auth-error" role="alert">
                {error}
              </p>
            )}

            <div className="auth-field">
              <label htmlFor="currentPassword">Current password</label>
              <input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

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
              />
            </div>

            <button type="submit" className="auth-submit" disabled={loading}>
              {loading ? "Saving…" : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </OnboardingGuard>
  );
}
