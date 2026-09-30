"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import {
  capturePageview,
  identifyUser,
  initPostHog,
  resetUser,
} from "@/lib/posthog";

function PostHogPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { session, isLoading } = useAuth();
  const identifiedId = useRef<string | null>(null);

  useEffect(() => {
    initPostHog();
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const userId = session?.user.id ?? null;
    if (userId && session) {
      identifyUser(session.user);
      identifiedId.current = userId;
    } else if (identifiedId.current) {
      resetUser();
      identifiedId.current = null;
    }
    capturePageview(pathname, searchParams.toString());
  }, [isLoading, pathname, searchParams, session]);

  return null;
}

export function PostHogAnalytics() {
  return (
    <Suspense fallback={null}>
      <PostHogPageView />
    </Suspense>
  );
}
