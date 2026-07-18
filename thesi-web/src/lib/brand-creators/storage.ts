"use client";

import { useCallback, useEffect, useState } from "react";
import type { CreatorDirectoryEntry, CreatorProfile } from "@/lib/creators/types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

export interface BrandCreatorFavoritesData {
  favoriteCreatorIds: string[];
}

const EMPTY_FAVORITES: BrandCreatorFavoritesData = { favoriteCreatorIds: [] };

export function useCreatorsDirectory(authenticatedRequest: AuthenticatedRequest) {
  const [creators, setCreators] = useState<CreatorProfile[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const data = await authenticatedRequest<{ creators: CreatorProfile[] }>(
      "/api/creators",
    );
    setCreators(data.creators);
    return data.creators;
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<{ creators: CreatorProfile[] }>("/api/creators")
      .then((data) => {
        if (active) setCreators(data.creators);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load creators",
          );
          setCreators([]);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest]);

  return { creators, ready, error, reload };
}

export function useCreatorDirectoryProfile(
  authenticatedRequest: AuthenticatedRequest,
  creatorId: string,
) {
  const [creator, setCreator] = useState<CreatorProfile | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<CreatorProfile>(`/api/creators/${creatorId}`)
      .then((data) => {
        if (active) setCreator(data);
      })
      .catch((requestError) => {
        if (active) {
          setCreator(null);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load creator",
          );
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest, creatorId]);

  return { creator, ready, error };
}

export function useBrandCreatorFavorites(authenticatedRequest: AuthenticatedRequest) {
  const [data, setData] = useState<BrandCreatorFavoritesData>(EMPTY_FAVORITES);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<BrandCreatorFavoritesData>("/api/creators/favorites")
      .then((next) => {
        if (active) setData(next);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load favorites",
          );
          setData(EMPTY_FAVORITES);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest]);

  const toggleFavorite = useCallback(
    async (creatorId: string) => {
      setError("");
      const isFav = data.favoriteCreatorIds.includes(creatorId);
      const next = await authenticatedRequest<BrandCreatorFavoritesData>(
        `/api/creators/${creatorId}/favorite`,
        { method: isFav ? "DELETE" : "POST", body: isFav ? undefined : {} },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest, data.favoriteCreatorIds],
  );

  return { data, ready, error, toggleFavorite };
}

export function isFavorite(data: BrandCreatorFavoritesData, creatorId: string): boolean {
  return data.favoriteCreatorIds.includes(creatorId);
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

export function toDirectoryEntries(creators: CreatorProfile[]): CreatorDirectoryEntry[] {
  return creators.map(
    ({ id, name, email, niches, location, platforms, followerRange }) => ({
      id,
      name,
      email,
      niches,
      location,
      platforms,
      followerRange,
    }),
  );
}
