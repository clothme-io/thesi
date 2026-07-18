"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  MarketplaceApplication,
  MarketplaceData,
  MarketplaceListing,
} from "./types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

type MarketplaceApiData = {
  listings: MarketplaceListing[];
  applications: MarketplaceApplication[];
  crmLinkedListingIds: string[];
};

const EMPTY: MarketplaceData = {
  customListings: [],
  listings: [],
  applications: [],
  crmLinkedListingIds: [],
};

export function useMarketplace(authenticatedRequest: AuthenticatedRequest) {
  const [data, setData] = useState<MarketplaceData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<MarketplaceApiData>("/api/marketplace");
    const normalized: MarketplaceData = {
      customListings: next.listings,
      listings: next.listings,
      applications: next.applications,
      crmLinkedListingIds: next.crmLinkedListingIds,
    };
    setData(normalized);
    return normalized;
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<MarketplaceApiData>("/api/marketplace")
      .then((next) => {
        if (!active) return;
        setData({
          customListings: next.listings,
          listings: next.listings,
          applications: next.applications,
          crmLinkedListingIds: next.crmLinkedListingIds,
        });
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load marketplace",
          );
          setData(EMPTY);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest]);

  const applyToListing = useCallback(
    async (listing: MarketplaceListing, pitch: string, linkToCrm: boolean) => {
      setError("");
      const result = await authenticatedRequest<{
        application: MarketplaceApplication;
        crmLinkedListingIds: string[];
      }>(`/api/marketplace/listings/${listing.id}/apply`, {
        method: "POST",
        body: { pitch, addToCrm: linkToCrm },
      });

      setData((prev) => ({
        ...prev,
        applications: [
          result.application,
          ...prev.applications.filter((app) => app.id !== result.application.id),
        ],
        crmLinkedListingIds: result.crmLinkedListingIds,
        listings: prev.listings.map((item) =>
          item.id === listing.id
            ? { ...item, applicantsCount: item.applicantsCount + 1 }
            : item,
        ),
      }));
      return result;
    },
    [authenticatedRequest],
  );

  const linkListingToCrm = useCallback(
    async (listing: MarketplaceListing) => {
      setError("");
      const result = await authenticatedRequest<{ crmLinkedListingIds: string[] }>(
        `/api/marketplace/listings/${listing.id}/crm-link`,
        { method: "POST", body: {} },
      );
      setData((prev) => ({
        ...prev,
        crmLinkedListingIds: result.crmLinkedListingIds,
      }));
      return result;
    },
    [authenticatedRequest],
  );

  return {
    data,
    ready,
    error,
    reload,
    applyToListing,
    linkListingToCrm,
  };
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
