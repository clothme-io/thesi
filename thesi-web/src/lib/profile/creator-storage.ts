"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorProfile } from "./creator-types";
import { DEFAULT_CREATOR_PROFILE } from "./creator-types";

const STORAGE_KEY = "thesi_creator_profile";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

export function loadCreatorProfile(fallbackName = ""): CreatorProfile {
  if (typeof window === "undefined") {
    return { ...DEFAULT_CREATOR_PROFILE, displayName: fallbackName };
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = { ...DEFAULT_CREATOR_PROFILE, displayName: fallbackName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    return { ...DEFAULT_CREATOR_PROFILE, ...JSON.parse(raw) } as CreatorProfile;
  } catch {
    const initial = { ...DEFAULT_CREATOR_PROFILE, displayName: fallbackName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

export function saveCreatorProfile(profile: CreatorProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function useCreatorProfile(
  authenticatedRequest: AuthenticatedRequest,
  fallbackName = "",
) {
  const [profile, setProfile] = useState<CreatorProfile>({
    ...DEFAULT_CREATOR_PROFILE,
    displayName: fallbackName,
  });
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<CreatorProfile>("/api/profile")
      .then((data) => {
        if (active) setProfile(data);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load your profile",
          );
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest, fallbackName]);

  const updateProfile = useCallback((patch: Partial<CreatorProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const persistProfile = useCallback(
    async (next: CreatorProfile) => {
      setSaving(true);
      setError("");
      try {
        const savedProfile = await authenticatedRequest<CreatorProfile>(
          "/api/profile/creator",
          { method: "PUT", body: next },
        );
        setProfile(savedProfile);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "Could not save your profile",
        );
        throw requestError;
      } finally {
        setSaving(false);
      }
    },
    [authenticatedRequest],
  );

  return {
    profile,
    ready,
    saved,
    saving,
    error,
    updateProfile,
    persistProfile,
  };
}
