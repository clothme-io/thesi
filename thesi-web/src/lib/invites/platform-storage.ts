"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlatformBrandInvite, PlatformInviteData } from "./platform-types";

const STORAGE_KEY = "thesi_platform_invites";

const EMPTY: PlatformInviteData = { brandInvites: [] };

export function loadPlatformInviteData(): PlatformInviteData {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(EMPTY));
    return EMPTY;
  }
  try {
    return JSON.parse(raw) as PlatformInviteData;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(EMPTY));
    return EMPTY;
  }
}

export function savePlatformInviteData(data: PlatformInviteData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function usePlatformInvites() {
  const [data, setData] = useState<PlatformInviteData>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadPlatformInviteData());
    setReady(true);
  }, []);

  const persist = useCallback((next: PlatformInviteData) => {
    setData(next);
    savePlatformInviteData(next);
  }, []);

  return { data, ready, persist };
}

export function addPlatformBrandInvite(
  data: PlatformInviteData,
  invite: PlatformBrandInvite,
): PlatformInviteData {
  return { brandInvites: [...data.brandInvites, invite] };
}
