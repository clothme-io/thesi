"use client";

import { useCallback, useEffect, useState } from "react";
import type { CrmCollabSnapshot, WorkspaceRole } from "./collab-types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

export function useCrmCollab(authenticatedRequest: AuthenticatedRequest) {
  const [data, setData] = useState<CrmCollabSnapshot | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<CrmCollabSnapshot>(
      "/api/creator-crm/workspace",
    );
    setData(next);
    return next;
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    setReady(false);
    authenticatedRequest<CrmCollabSnapshot>("/api/creator-crm/workspace")
      .then((next) => {
        if (active) setData(next);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load workspace",
          );
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest]);

  const renameWorkspace = useCallback(
    async (name: string) => {
      setError("");
      const next = await authenticatedRequest<CrmCollabSnapshot>(
        "/api/creator-crm/workspace",
        { method: "PATCH", body: { name } },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const inviteMember = useCallback(
    async (input: { email: string; role?: WorkspaceRole }) => {
      setError("");
      const next = await authenticatedRequest<CrmCollabSnapshot>(
        "/api/creator-crm/workspace/invites",
        { method: "POST", body: input },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const removeMember = useCallback(
    async (memberId: string) => {
      setError("");
      const next = await authenticatedRequest<CrmCollabSnapshot>(
        `/api/creator-crm/workspace/members/${memberId}`,
        { method: "DELETE" },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const connectIntegration = useCallback(
    async (connectionId: string, accountEmail: string) => {
      setError("");
      const next = await authenticatedRequest<CrmCollabSnapshot>(
        `/api/creator-crm/integrations/${connectionId}/connect`,
        { method: "POST", body: { accountEmail } },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const disconnectIntegration = useCallback(
    async (connectionId: string) => {
      setError("");
      const next = await authenticatedRequest<CrmCollabSnapshot>(
        `/api/creator-crm/integrations/${connectionId}/disconnect`,
        { method: "POST" },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const syncIntegration = useCallback(
    async (connectionId: string) => {
      setError("");
      const next = await authenticatedRequest<CrmCollabSnapshot>(
        `/api/creator-crm/integrations/${connectionId}/sync`,
        { method: "POST" },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  return {
    data,
    ready,
    error,
    reload,
    renameWorkspace,
    inviteMember,
    removeMember,
    connectIntegration,
    disconnectIntegration,
    syncIntegration,
  };
}
