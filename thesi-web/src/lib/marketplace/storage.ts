"use client";

import { useCallback, useEffect, useState } from "react";
import { loadCrmData, saveCrmData } from "@/lib/creator-crm/storage";
import { addListingToCrm } from "./crm-integration";
import type { MarketplaceApplication, MarketplaceData, MarketplaceListing } from "./types";
import { SEED_MARKETPLACE_DATA } from "./seed";

const STORAGE_KEY = "thesi_marketplace";

export function loadMarketplaceData(): MarketplaceData {
  if (typeof window === "undefined") return SEED_MARKETPLACE_DATA;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_MARKETPLACE_DATA));
    return SEED_MARKETPLACE_DATA;
  }
  try {
    const parsed = JSON.parse(raw) as MarketplaceData;
    return {
      ...SEED_MARKETPLACE_DATA,
      ...parsed,
      listings: SEED_MARKETPLACE_DATA.listings,
    };
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_MARKETPLACE_DATA));
    return SEED_MARKETPLACE_DATA;
  }
}

export function saveMarketplaceData(data: MarketplaceData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useMarketplace() {
  const [data, setData] = useState<MarketplaceData>(SEED_MARKETPLACE_DATA);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadMarketplaceData());
    setReady(true);
  }, []);

  const persist = useCallback((next: MarketplaceData) => {
    setData(next);
    saveMarketplaceData(next);
  }, []);

  return { data, ready, persist };
}

export function getListingById(data: MarketplaceData, id: string) {
  return data.listings.find((l) => l.id === id);
}

export function hasApplied(data: MarketplaceData, listingId: string) {
  return data.applications.some((a) => a.listingId === listingId);
}

export function isInCrm(data: MarketplaceData, listingId: string) {
  return data.crmLinkedListingIds.includes(listingId);
}

export function applyToListing(
  marketplace: MarketplaceData,
  listing: MarketplaceListing,
  pitch: string,
  linkToCrm: boolean,
): { marketplace: MarketplaceData; crmUpdated: boolean } {
  const now = new Date().toISOString();
  let nextMarketplace = marketplace;

  if (!hasApplied(marketplace, listing.id)) {
    const application: MarketplaceApplication = {
      id: `app-${Date.now()}`,
      listingId: listing.id,
      pitch,
      appliedAt: now,
      addedToCrm: linkToCrm,
    };
    nextMarketplace = {
      ...marketplace,
      applications: [...marketplace.applications, application],
      crmLinkedListingIds: linkToCrm
        ? [...new Set([...marketplace.crmLinkedListingIds, listing.id])]
        : marketplace.crmLinkedListingIds,
    };
  }

  if (linkToCrm && !marketplace.crmLinkedListingIds.includes(listing.id)) {
    const crm = loadCrmData();
    saveCrmData(addListingToCrm(crm, listing));
    nextMarketplace = {
      ...nextMarketplace,
      crmLinkedListingIds: [...new Set([...nextMarketplace.crmLinkedListingIds, listing.id])],
    };
    return { marketplace: nextMarketplace, crmUpdated: true };
  }

  return { marketplace: nextMarketplace, crmUpdated: false };
}

export function linkListingToCrm(
  marketplace: MarketplaceData,
  listing: MarketplaceListing,
): MarketplaceData {
  if (marketplace.crmLinkedListingIds.includes(listing.id)) {
    return marketplace;
  }
  const crm = loadCrmData();
  saveCrmData(addListingToCrm(crm, listing));
  return {
    ...marketplace,
    crmLinkedListingIds: [...marketplace.crmLinkedListingIds, listing.id],
  };
}
