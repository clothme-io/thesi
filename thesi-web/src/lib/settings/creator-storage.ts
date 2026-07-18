"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorSettings } from "./creator-types";
import { DEFAULT_CREATOR_SETTINGS } from "./creator-types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

export function useCreatorSettings(
  authenticatedRequest: AuthenticatedRequest,
) {
  const [settings, setSettings] = useState<CreatorSettings>(DEFAULT_CREATOR_SETTINGS);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<CreatorSettings>("/api/settings")
      .then((data) => {
        if (active) setSettings(data);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load settings",
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

  const updateSettings = useCallback((patch: Partial<CreatorSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const persistSettings = useCallback(
    async (next: CreatorSettings) => {
      setSaving(true);
      setError("");
      try {
        const savedSettings = await authenticatedRequest<CreatorSettings>(
          "/api/settings/creator",
          { method: "PUT", body: next },
        );
        setSettings(savedSettings);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not save settings",
        );
        throw requestError;
      } finally {
        setSaving(false);
      }
    },
    [authenticatedRequest],
  );

  return {
    settings,
    ready,
    saved,
    saving,
    error,
    updateSettings,
    persistSettings,
  };
}
