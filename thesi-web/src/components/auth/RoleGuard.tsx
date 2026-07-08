"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import type { UserRole } from "@/lib/auth-types";

export function RoleGuard({
  allow,
  redirectTo = "/app/dashboard",
  children,
}: {
  allow: UserRole[];
  redirectTo?: string;
  children: React.ReactNode;
}) {
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!session) return;
    if (!allow.includes(session.user.role)) {
      router.replace(redirectTo);
    }
  }, [allow, isLoading, redirectTo, router, session, pathname]);

  if (isLoading) return null;
  if (!session) return null;
  if (!allow.includes(session.user.role)) return null;

  return <>{children}</>;
}

