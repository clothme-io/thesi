import type { AuthSession, SignInInput, SignUpInput } from "./auth-types";

const STORAGE_KEY = "thesi_auth_session";

export function getStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function storeSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function isAuthDevMode(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_DEV_MODE === "true";
}

/** Temporary dev auth for UI work without a running database. */
export function createDevSession(input: SignInInput | SignUpInput, role: "creator" | "brand"): AuthSession {
  const fullName = "fullName" in input ? input.fullName : "Demo Creator";
  const simulateTempPassword = input.password === "temp123";

  return {
    accessToken: "dev-access-token",
    refreshToken: "dev-refresh-token",
    user: {
      id: "dev-user-1",
      email: input.email,
      fullName,
      role,
      mustChangePassword: simulateTempPassword,
      onboardingCompleted: false,
      onboardingStep: simulateTempPassword ? "change-password" : "welcome",
    },
  };
}

export function getPostAuthPath(session: AuthSession): string {
  const { user } = session;
  if (user.mustChangePassword || user.onboardingStep === "change-password") {
    return "/onboarding/change-password";
  }
  if (!user.onboardingCompleted) {
    if (user.onboardingStep === "questions") return "/onboarding/questions";
    return "/onboarding/welcome";
  }
  return "/app/dashboard";
}

export function getOnboardingPathForStep(
  step: AuthSession["user"]["onboardingStep"],
): string {
  switch (step) {
    case "change-password":
      return "/onboarding/change-password";
    case "welcome":
      return "/onboarding/welcome";
    case "questions":
      return "/onboarding/questions";
    default:
      return "/app/dashboard";
  }
}
