"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorProfile } from "./types";
import { DEFAULT_PROFILE } from "./types";

const STORAGE_KEY = "thesi_creator_profile";

export function loadProfile(fallbackName = ""): CreatorProfile {
  if (typeof window === "undefined") {
    return { ...DEFAULT_PROFILE, displayName: fallbackName };
  }
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    const initial = { ...DEFAULT_PROFILE, displayName: fallbackName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
  try {
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) } as CreatorProfile;
  } catch {
    const initial = { ...DEFAULT_PROFILE, displayName: fallbackName };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
    return initial;
  }
}

export function saveProfile(profile: CreatorProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
}

export function useCreatorProfile(fallbackName = "") {
  const [profile, setProfile] = useState<CreatorProfile>({
    ...DEFAULT_PROFILE,
    displayName: fallbackName,
  });
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setProfile(loadProfile(fallbackName));
    setReady(true);
  }, [fallbackName]);

  const updateProfile = useCallback((patch: Partial<CreatorProfile>) => {
    setProfile((prev) => ({ ...prev, ...patch }));
    setSaved(false);
  }, []);

  const persistProfile = useCallback((next: CreatorProfile) => {
    setProfile(next);
    saveProfile(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, []);

  return { profile, ready, saved, updateProfile, persistProfile };
}

export function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
