"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthSession, OnboardingAnswers, SignInInput, SignUpInput } from "@/lib/auth-types";
import {
  createDevSession,
  getStoredSession,
  isAuthDevMode,
  storeSession,
} from "@/lib/auth-storage";

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  signIn: (input: SignInInput) => Promise<AuthSession>;
  signUp: (input: SignUpInput) => Promise<AuthSession>;
  signOut: () => void;
  changePassword: (input: {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
  }) => Promise<void>;
  completeWelcome: () => Promise<void>;
  submitOnboarding: (answers: OnboardingAnswers) => Promise<void>;
  updateSession: (session: AuthSession) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

async function callAuthApi<T>(
  path: string,
  body: unknown,
  accessToken?: string,
): Promise<T> {
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || "Request failed");
  }
  return json.data as T;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(getStoredSession());
    setIsLoading(false);
  }, []);

  const persist = useCallback((next: AuthSession | null) => {
    setSession(next);
    storeSession(next);
  }, []);

  const signIn = useCallback(
    async (input: SignInInput) => {
      if (isAuthDevMode()) {
        const role = input.email.trim().toLowerCase() === "brand@thesi.dev" ? "brand" : "creator";
        const devSession = createDevSession(input, role);
        persist(devSession);
        return devSession;
      }

      const data = await callAuthApi<AuthSession>("/api/auth/signin", input);
      persist(data);
      return data;
    },
    [persist],
  );

  const signUp = useCallback(
    async (input: SignUpInput) => {
      if (isAuthDevMode()) {
        const devSession = createDevSession(input, "brand");
        persist(devSession);
        return devSession;
      }

      const data = await callAuthApi<AuthSession>("/api/auth/signup", input);
      persist(data);
      return data;
    },
    [persist],
  );

  const signOut = useCallback(() => {
    persist(null);
  }, [persist]);

  const changePassword = useCallback(
    async (input: { currentPassword: string; newPassword: string; confirmPassword: string }) => {
      if (!session) return;

      if (isAuthDevMode()) {
        persist({
          ...session,
          user: {
            ...session.user,
            mustChangePassword: false,
            onboardingStep: "welcome",
          },
        });
        return;
      }

      const data = await callAuthApi<AuthSession>(
        "/api/auth/change-password",
        input,
        session.accessToken,
      );
      persist(data);
    },
    [persist, session],
  );

  const completeWelcome = useCallback(async () => {
    if (!session) return;

    if (isAuthDevMode()) {
      persist({
        ...session,
        user: { ...session.user, onboardingStep: "questions" },
      });
      return;
    }

    const data = await callAuthApi<AuthSession>(
      "/api/auth/onboarding/welcome",
      {},
      session.accessToken,
    );
    persist(data);
  }, [persist, session]);

  const submitOnboarding = useCallback(
    async (answers: OnboardingAnswers) => {
      if (!session) return;

      if (isAuthDevMode()) {
        persist({
          ...session,
          user: {
            ...session.user,
            onboardingCompleted: true,
            onboardingStep: "complete",
          },
        });
        return;
      }

      const data = await callAuthApi<AuthSession>(
        "/api/auth/onboarding",
        answers,
        session.accessToken,
      );
      persist(data);
    },
    [persist, session],
  );

  const updateSession = useCallback(
    (next: AuthSession) => {
      persist(next);
    },
    [persist],
  );

  const value = useMemo(
    () => ({
      session,
      isLoading,
      signIn,
      signUp,
      signOut,
      changePassword,
      completeWelcome,
      submitOnboarding,
      updateSession,
    }),
    [
      session,
      isLoading,
      signIn,
      signUp,
      signOut,
      changePassword,
      completeWelcome,
      submitOnboarding,
      updateSession,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
