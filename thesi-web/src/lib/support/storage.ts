import { useCallback, useEffect, useState } from "react";
import type { SupportListData, SupportMessage, SupportThreadData } from "./types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

const EMPTY: SupportListData = { threads: [] };

export function useSupport(authenticatedRequest: AuthenticatedRequest) {
  const [data, setData] = useState<SupportListData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<SupportListData>("/api/support");
    setData(next);
    return next;
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<SupportListData>("/api/support")
      .then((next) => {
        if (active) setData(next);
      })
      .catch((requestError) => {
        if (!active) return;
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load support messages",
        );
        setData(EMPTY);
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest]);

  const createThread = useCallback(
    async (subject: string, content: string) => {
      const created = await authenticatedRequest<SupportThreadData>(
        "/api/support/threads",
        {
          method: "POST",
          body: { subject, content },
        },
      );
      setData((prev) => ({
        ...prev,
        threads: [
          created.thread,
          ...prev.threads.filter((thread) => thread.id !== created.thread.id),
        ],
      }));
      return created;
    },
    [authenticatedRequest],
  );

  const getThread = useCallback(
    (threadId: string) =>
      authenticatedRequest<SupportThreadData>(`/api/support/threads/${threadId}`),
    [authenticatedRequest],
  );

  const sendMessage = useCallback(
    async (threadId: string, content: string) =>
      authenticatedRequest<SupportMessage>("/api/support/messages", {
        method: "POST",
        body: { threadId, content },
      }),
    [authenticatedRequest],
  );

  return {
    data,
    ready,
    error,
    reload,
    createThread,
    getThread,
    sendMessage,
  };
}
