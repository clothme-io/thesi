"use client";

import { useRouter } from "next/navigation";
import { OnboardingGuard, getOnboardingProgress } from "@/components/auth/OnboardingGuard";
import { useAuth } from "@/context/AuthProvider";

export default function WelcomePage() {
  const router = useRouter();
  const { completeWelcome, session } = useAuth();
  const isBrand = session?.user.role === "brand";

  function handleContinue() {
    completeWelcome();
    router.push("/onboarding/questions");
  }

  return (
    <OnboardingGuard>
      <div className="onboarding-page">
        <div className="onboarding-card">
          <div className="onboarding-progress">
            <div
              className="onboarding-progress-bar"
              style={{ width: `${getOnboardingProgress("/onboarding/welcome")}%` }}
            />
          </div>
          <h1>Welcome to Thesi</h1>
          {isBrand ? (
            <p>
              We built Thesi so brands can run UGC campaigns like a real operation — not a patchwork of
              spreadsheets, DMs, and scattered approvals.
            </p>
          ) : (
            <p>
              We built Thesi so UGC creators can run their business like a real operation — not a patchwork of
              DMs, spreadsheets, and overdue invoices.
            </p>
          )}

          <div className="onboarding-founder">
            <div className="onboarding-founder-avatar" aria-hidden="true">
              CM
            </div>
            <div>
              <strong>From the ClothME founder</strong>
              <p style={{ marginTop: 8 }}>
                {isBrand ? (
                  <>
                    You are joining as a founding brand partner. We are still shaping the platform, and your
                    feedback will directly influence what we build next. Thank you for being here early.
                  </>
                ) : (
                  <>
                    You are joining as a founding creator. We are still shaping the platform, and your feedback
                    will directly influence what we build next. Thank you for being here early.
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="onboarding-actions">
            <button type="button" className="onboarding-primary" onClick={handleContinue}>
              Continue
            </button>
          </div>
        </div>
      </div>
    </OnboardingGuard>
  );
}
