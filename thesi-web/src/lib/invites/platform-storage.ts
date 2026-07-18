"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlatformInviteData } from "./platform-types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

const EMPTY: PlatformInviteData = { brandInvites: [] };

export function usePlatformInvites(authenticatedRequest: AuthenticatedRequest) {
  const [data, setData] = useState<PlatformInviteData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<PlatformInviteData>(
      "/api/invites/platform-brand",
    );
    setData(next);
    return next;
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<PlatformInviteData>("/api/invites/platform-brand")
      .then((next) => {
        if (active) setData(next);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load platform invites",
          );
          setData(EMPTY);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest]);

  return { data, ready, error, reload };
}
