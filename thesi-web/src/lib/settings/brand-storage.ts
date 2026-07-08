"use client";

import { useCallback, useEffect, useState } from "react";
import type { BrandSettings } from "./brand-types";
import { DEFAULT_BRAND_SETTINGS } from "./brand-types";

const STORAGE_KEY = "thesi_brand_settings";

export function loadBrandSettings(): BrandSettings {
  if (typeof window === "undefined") return DEFAULT_BRAND_SETTINGS;
  const legacy = localStorage.getItem("thesi_app_settings");
  const raw = localStorage.getItem(STORAGE_KEY) ?? legacy;
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BRAND_SETTINGS));
    return DEFAULT_BRAND_SETTINGS;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<BrandSettings> & { dealUpdates?: boolean };
    return {
      ...DEFAULT_BRAND_SETTINGS,
      ...parsed,
      campaignUpdates:
        parsed.campaignUpdates ??
        parsed.dealUpdates ??
        DEFAULT_BRAND_SETTINGS.campaignUpdates,
    };
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_BRAND_SETTINGS));
    return DEFAULT_BRAND_SETTINGS;
  }
}

export function saveBrandSettings(settings: BrandSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useBrandSettings() {
  const [settings, setSettings] = useState<BrandSettings>(DEFAULT_BRAND_SETTINGS);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadBrandSettings());
    setReady(true);
  }, []);

  const updateSettings = useCallback((patch: Partial<BrandSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const persistSettings = useCallback((next: BrandSettings) => {
    setSettings(next);
    saveBrandSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, []);

  return { settings, ready, saved, updateSettings, persistSettings };
}
