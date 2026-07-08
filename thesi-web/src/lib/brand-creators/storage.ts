"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorProfile } from "@/lib/creators/types";

const STORAGE_KEY = "thesi_brand_creator_favorites";

export interface BrandCreatorFavoritesData {
  favoriteCreatorIds: string[];
}

const EMPTY: BrandCreatorFavoritesData = { favoriteCreatorIds: [] };

export function loadBrandCreatorFavorites(): BrandCreatorFavoritesData {
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(EMPTY));
    return EMPTY;
  }
  try {
    return JSON.parse(raw) as BrandCreatorFavoritesData;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(EMPTY));
    return EMPTY;
  }
}

export function saveBrandCreatorFavorites(data: BrandCreatorFavoritesData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useBrandCreatorFavorites() {
  const [data, setData] = useState<BrandCreatorFavoritesData>(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadBrandCreatorFavorites());
    setReady(true);
  }, []);

  const persist = useCallback((next: BrandCreatorFavoritesData) => {
    setData(next);
    saveBrandCreatorFavorites(next);
  }, []);

  return { data, ready, persist };
}

export function isFavorite(data: BrandCreatorFavoritesData, creatorId: string): boolean {
  return data.favoriteCreatorIds.includes(creatorId);
}

export function toggleFavorite(data: BrandCreatorFavoritesData, creatorId: string): BrandCreatorFavoritesData {
  const set = new Set(data.favoriteCreatorIds);
  if (set.has(creatorId)) set.delete(creatorId);
  else set.add(creatorId);
  return { favoriteCreatorIds: [...set] };
}

export function sortCreatorsWithFavoritesFirst<T extends { id: string }>(
  creators: T[],
  favoriteIds: string[],
): T[] {
  const favSet = new Set(favoriteIds);
  return [...creators].sort((a, b) => {
    const aFav = favSet.has(a.id);
    const bFav = favSet.has(b.id);
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });
}

export function sortProfilesWithFavoritesFirst(
  profiles: CreatorProfile[],
  favoriteIds: string[],
): CreatorProfile[] {
  return sortCreatorsWithFavoritesFirst(profiles, favoriteIds);
}
