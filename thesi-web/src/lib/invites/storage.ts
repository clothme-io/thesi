"use client";

import { useCallback, useEffect, useState } from "react";
import type { CampaignInvite, InviteData } from "./types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

const EMPTY: InviteData = { invites: [] };

export function useInvites(
  authenticatedRequest: AuthenticatedRequest,
  enabled = true,
) {
  const [data, setData] = useState<InviteData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(
    async (campaignId?: string) => {
      if (!enabled) {
        setData(EMPTY);
        setError("");
        return EMPTY;
      }
      setError("");
      const path = campaignId
        ? `/api/invites/campaign?campaignId=${encodeURIComponent(campaignId)}`
        : "/api/invites/campaign";
      const next = await authenticatedRequest<InviteData>(path);
      setData(next);
      return next;
    },
    [authenticatedRequest, enabled],
  );

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setData(EMPTY);
      setError("");
      setReady(true);
      return () => {
        active = false;
      };
    }
    setReady(false);
    setError("");
    authenticatedRequest<InviteData>("/api/invites/campaign")
      .then((next) => {
        if (active) setData(next);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load invites",
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
  }, [authenticatedRequest, enabled]);

  return { data, ready, error, reload, setData };
}

export function getInvitesForCampaign(data: InviteData, campaignId: string): CampaignInvite[] {
  return data.invites.filter((i) => i.campaignId === campaignId);
}
