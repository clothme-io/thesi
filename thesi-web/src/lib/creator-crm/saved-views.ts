"use client";

import { useEffect, useState } from "react";

export type SavedView = {
  id: string;
  name: string;
  filters: Record<string, string>;
};

function storageKey(entity: string, userId: string) {
  return `thesi:crm:views:${entity}:${userId}`;
}

export function useSavedViews(entity: string, userId: string | undefined) {
  const [views, setViews] = useState<SavedView[]>([]);

  useEffect(() => {
    if (!userId || typeof window === "undefined") {
      setViews([]);
      return;
    }
    try {
      const raw = window.localStorage.getItem(storageKey(entity, userId));
      setViews(raw ? (JSON.parse(raw) as SavedView[]) : []);
    } catch {
      setViews([]);
    }
  }, [entity, userId]);

  const persist = (next: SavedView[]) => {
    setViews(next);
    if (!userId || typeof window === "undefined") return;
    window.localStorage.setItem(
      storageKey(entity, userId),
      JSON.stringify(next),
    );
  };

  const saveView = (name: string, filters: Record<string, string>) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const next = [
      ...views.filter((view) => view.name.toLowerCase() !== trimmed.toLowerCase()),
      {
        id: `${Date.now()}`,
        name: trimmed,
        filters,
      },
    ].slice(-12);
    persist(next);
  };

  const deleteView = (id: string) => {
    persist(views.filter((view) => view.id !== id));
  };

  return { views, saveView, deleteView };
}
