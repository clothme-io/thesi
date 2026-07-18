"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { getOnboardingPathForStep, getPostAuthPath } from "@/lib/auth-storage";

const STEP_PATHS = [
  "/onboarding/change-password",
  "/onboarding/welcome",
  "/onboarding/questions",
] as const;

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace("/sign-in");
      return;
    }

    const isAccountPasswordChange =
      session.user.onboardingCompleted &&
      pathname === "/onboarding/change-password";

    if (session.user.onboardingCompleted && !isAccountPasswordChange) {
      router.replace("/app/dashboard");
      return;
    }
    if (isAccountPasswordChange) return;

    const expected = getOnboardingPathForStep(session.user.onboardingStep);
    if (pathname !== expected) {
      router.replace(expected);
    }
  }, [isLoading, session, router, pathname]);

  if (isLoading || !session) return null;
  if (
    session.user.onboardingCompleted &&
    pathname === "/onboarding/change-password"
  ) {
    return <>{children}</>;
  }
  if (session.user.onboardingCompleted) return null;
  if (pathname !== getOnboardingPathForStep(session.user.onboardingStep)) return null;

  return <>{children}</>;
}

export function getOnboardingProgress(pathname: string): number {
  const index = STEP_PATHS.indexOf(pathname as (typeof STEP_PATHS)[number]);
  if (index < 0) return 0;
  return ((index + 1) / STEP_PATHS.length) * 100;
}

export { getPostAuthPath };
