"use client";

import { useCallback, useEffect, useState } from "react";
import type { BrandProfile } from "./brand-types";
import { DEFAULT_BRAND_PROFILE } from "./brand-types";

const STORAGE_KEY = "thesi_brand_profile";

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

export function useBrandProfile(fallbackCompanyName = "") {
  const [profile, setProfile] = useState<BrandProfile>({
    ...DEFAULT_BRAND_PROFILE,
    companyName: fallbackCompanyName,
  });
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(loadBrandProfile(fallbackCompanyName));
    setReady(true);
  }, [fallbackCompanyName]);

  const updateProfile = useCallback((patch: Partial<BrandProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const persistProfile = useCallback((next: BrandProfile) => {
    setProfile(next);
    saveBrandProfile(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, []);

  return { profile, ready, saved, updateProfile, persistProfile };
}
