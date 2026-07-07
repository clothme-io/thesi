"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { getPostAuthPath } from "@/lib/auth-storage";

export function AppGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace("/sign-in");
      return;
    }
    const target = getPostAuthPath(session);
    if (!target.startsWith("/app")) {
      router.replace(target);
    }
  }, [isLoading, session, router]);

  if (isLoading || !session) return null;
  if (!session.user.onboardingCompleted || session.user.mustChangePassword) return null;

  return <>{children}</>;
}
