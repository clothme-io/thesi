"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { getPostAuthPath } from "@/lib/auth-storage";

export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && session) {
      router.replace(getPostAuthPath(session));
    }
  }, [isLoading, session, router]);

  if (isLoading || session) return null;
  return <>{children}</>;
}
