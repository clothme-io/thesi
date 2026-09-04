"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  MarketplaceApplication,
  MarketplaceBrandApplication,
  MarketplaceData,
  MarketplaceFile,
  MarketplaceListing,
} from "./types";
import { normalizeMarketplaceListing } from "./types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

type AuthenticatedBinaryRequest = (
  path: string,
  options?: {
    method?: "GET" | "DELETE";
  },
) => Promise<{ blob: Blob; fileName: string | null }>;

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
    const listings = next.listings.map(normalizeMarketplaceListing);
    const normalized: MarketplaceData = {
      customListings: listings,
      listings,
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
        const listings = next.listings.map(normalizeMarketplaceListing);
        setData({
          customListings: listings,
          listings,
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
  const listing = data.listings.find((l) => l.id === id);
  return listing ? normalizeMarketplaceListing(listing) : undefined;
}

export function hasApplied(data: MarketplaceData, listingId: string) {
  return data.applications.some((a) => a.listingId === listingId);
}

export function isInCrm(data: MarketplaceData, listingId: string) {
  return data.crmLinkedListingIds.includes(listingId);
}

export async function downloadMarketplaceFile(
  authenticatedBinaryRequest: AuthenticatedBinaryRequest,
  listingId: string,
  file: MarketplaceFile,
) {
  const result = await authenticatedBinaryRequest(
    `/api/marketplace/listings/${listingId}/files/${file.id}/download`,
  );
  const url = URL.createObjectURL(result.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.fileName || file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function fetchListingApplications(
  authenticatedRequest: AuthenticatedRequest,
  listingId: string,
) {
  const data = await authenticatedRequest<{
    applications: MarketplaceBrandApplication[];
  }>(`/api/marketplace/listings/${listingId}/applications`);
  return data.applications;
}

export async function respondToListingApplication(
  authenticatedRequest: AuthenticatedRequest,
  listingId: string,
  applicationId: string,
  decision: "accepted" | "rejected",
) {
  const data = await authenticatedRequest<{
    application: MarketplaceApplication;
  }>(`/api/marketplace/listings/${listingId}/applications/${applicationId}/respond`, {
    method: "POST",
    body: { decision },
  });
  return data.application;
}
