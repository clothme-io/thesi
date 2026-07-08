"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorSettings } from "./creator-types";
import { DEFAULT_CREATOR_SETTINGS } from "./creator-types";

const STORAGE_KEY = "thesi_creator_settings";

export function loadCreatorSettings(): CreatorSettings {
  if (typeof window === "undefined") return DEFAULT_CREATOR_SETTINGS;
  const legacy = localStorage.getItem("thesi_app_settings");
  const raw = localStorage.getItem(STORAGE_KEY) ?? legacy;
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CREATOR_SETTINGS));
    return DEFAULT_CREATOR_SETTINGS;
  }
  try {
    return { ...DEFAULT_CREATOR_SETTINGS, ...JSON.parse(raw) } as CreatorSettings;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_CREATOR_SETTINGS));
    return DEFAULT_CREATOR_SETTINGS;
  }
}

export function saveCreatorSettings(settings: CreatorSettings) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

export function useCreatorSettings() {
  const [settings, setSettings] = useState<CreatorSettings>(DEFAULT_CREATOR_SETTINGS);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setSettings(loadCreatorSettings());
    setReady(true);
  }, []);

  const updateSettings = useCallback((patch: Partial<CreatorSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const persistSettings = useCallback((next: CreatorSettings) => {
    setSettings(next);
    saveCreatorSettings(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, []);

  return { settings, ready, saved, updateSettings, persistSettings };
}
