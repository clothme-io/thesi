"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { OnboardingGuard, getOnboardingProgress } from "@/components/auth/OnboardingGuard";
import { useAuth } from "@/context/AuthProvider";
import {
  BRAND_ONBOARDING_QUESTIONS,
  CREATOR_ONBOARDING_QUESTIONS,
  type OnboardingAnswers,
} from "@/lib/auth-types";

const EMPTY_ANSWERS: OnboardingAnswers = {
  contentType: "",
  monthlyProjects: "",
  preferredPayment: "",
  biggestChallenge: "",
  hearAbout: "",
  companySize: "",
  monthlyCampaigns: "",
  primaryGoal: "",
  budgetRange: "",
};

export default function QuestionsPage() {
  const router = useRouter();
  const { submitOnboarding, session } = useAuth();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(EMPTY_ANSWERS);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const questions =
    session?.user.role === "brand" ? BRAND_ONBOARDING_QUESTIONS : CREATOR_ONBOARDING_QUESTIONS;
  const question = questions[step];
  const currentValue = answers[question.key];

  function selectOption(value: string) {
    setAnswers((prev) => ({ ...prev, [question.key]: value }));
  }

  async function handleNext() {
    if (!currentValue) {
      setError("Please select an option to continue.");
      return;
    }
    setError("");

    if (step < questions.length - 1) {
      setStep((s) => s + 1);
      return;
    }

    setLoading(true);
    try {
      await submitOnboarding(answers);
      router.push("/app/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your answers");
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
              style={{ width: `${getOnboardingProgress("/onboarding/questions")}%` }}
            />
          </div>
          <p className="eyebrow" style={{ marginBottom: 12 }}>
            Question {step + 1} of {questions.length}
          </p>
          <h1>{question.label}</h1>
          <p>Help us tailor Thesi to how you actually work.</p>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <div className="onboarding-options">
            {question.options.map((option) => (
              <label
                key={option}
                className={`onboarding-option ${currentValue === option ? "onboarding-option--selected" : ""}`}
              >
                <input
                  type="radio"
                  name={question.key}
                  value={option}
                  checked={currentValue === option}
                  onChange={() => selectOption(option)}
                />
                {option}
              </label>
            ))}
          </div>

          <div className="onboarding-actions">
            <button
              type="button"
              className="onboarding-secondary"
              disabled={step === 0 || loading}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
            >
              Back
            </button>
            <button
              type="button"
              className="onboarding-primary"
              disabled={loading}
              onClick={handleNext}
            >
              {loading ? "Saving…" : step === questions.length - 1 ? "Go to dashboard" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </OnboardingGuard>
  );
}
