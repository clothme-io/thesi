"use client";

import { useCallback, useEffect, useState } from "react";
import type { BrandProfile } from "./brand-types";
import { DEFAULT_BRAND_PROFILE } from "./brand-types";

const STORAGE_KEY = "thesi_brand_profile";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

export function loadBrandProfile(fallbackCompanyName = ""): BrandProfile {
  if (typeof window === "undefined") {
    return { ...DEFAULT_BRAND_PROFILE, companyName: fallbackCompanyName };
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = { ...DEFAULT_BRAND_PROFILE, companyName: fallbackCompanyName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    return { ...DEFAULT_BRAND_PROFILE, ...JSON.parse(raw) } as BrandProfile;
  } catch {
    const initial = { ...DEFAULT_BRAND_PROFILE, companyName: fallbackCompanyName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

export function saveBrandProfile(profile: BrandProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function useBrandProfile(
  authenticatedRequest: AuthenticatedRequest,
  fallbackCompanyName = "",
) {
  const [profile, setProfile] = useState<BrandProfile>({
    ...DEFAULT_BRAND_PROFILE,
    companyName: fallbackCompanyName,
  });
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<BrandProfile>("/api/profile")
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
  }, [authenticatedRequest, fallbackCompanyName]);

  const updateProfile = useCallback((patch: Partial<BrandProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const persistProfile = useCallback(
    async (next: BrandProfile) => {
      setSaving(true);
      setError("");
      try {
        const savedProfile = await authenticatedRequest<BrandProfile>(
          "/api/profile/brand",
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
