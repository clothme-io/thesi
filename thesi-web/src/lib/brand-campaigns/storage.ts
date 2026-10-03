"use client";

import { useCallback, useEffect, useState } from "react";
import type { BrandCampaign, BrandCampaignData, BrandCampaignFile } from "./types";

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

export type CampaignInput = Omit<BrandCampaign, "id" | "createdAt" | "updatedAt"> & { merchantProductId?: string | null;merchantProducts?:{productId:string;variantIds?:string[]}[] };

function campaignRequest(input: CampaignInput) {
  const payment = { ...input.payment };
  delete payment.promotedProduct;
  delete payment.promotedProducts;
  return { ...input, payment };
}

const EMPTY_DATA: BrandCampaignData = { campaigns: [] };
const CAMPAIGNS_CHANGED_EVENT = "thesi:campaigns-changed";
const CAMPAIGNS_STALE_KEY = "thesi_campaigns_changed_at";

function markCampaignsChanged() {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(CAMPAIGNS_STALE_KEY, String(Date.now()));
  window.dispatchEvent(new Event(CAMPAIGNS_CHANGED_EVENT));
}

function clearCampaignsChanged() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(CAMPAIGNS_STALE_KEY);
}

function campaignsChanged() {
  if (typeof window === "undefined") return false;
  return Boolean(sessionStorage.getItem(CAMPAIGNS_STALE_KEY));
}

export function useBrandCampaigns(authenticatedRequest: AuthenticatedRequest) {
  const [data, setData] = useState<BrandCampaignData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<BrandCampaignData>("/api/campaigns");
    setData(next);
    clearCampaignsChanged();
    return next;
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<BrandCampaignData>("/api/campaigns")
      .then((next) => {
        if (active) {
          setData(next);
          clearCampaignsChanged();
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load campaigns",
          );
          setData(EMPTY_DATA);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    let reloading = false;

    const reloadIfNeeded = () => {
      if (!active || reloading || !campaignsChanged()) return;
      reloading = true;
      reload().finally(() => {
        reloading = false;
      });
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") reloadIfNeeded();
    };

    window.addEventListener(CAMPAIGNS_CHANGED_EVENT, reloadIfNeeded);
    window.addEventListener("focus", reloadIfNeeded);
    window.addEventListener("pageshow", reloadIfNeeded);
    window.addEventListener("popstate", reloadIfNeeded);
    document.addEventListener("visibilitychange", handleVisibility);
    reloadIfNeeded();

    return () => {
      active = false;
      window.removeEventListener(CAMPAIGNS_CHANGED_EVENT, reloadIfNeeded);
      window.removeEventListener("focus", reloadIfNeeded);
      window.removeEventListener("pageshow", reloadIfNeeded);
      window.removeEventListener("popstate", reloadIfNeeded);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [reload]);

  const createCampaign = useCallback(
    async (input: CampaignInput) => {
      setError("");
      const campaign = await authenticatedRequest<BrandCampaign>("/api/campaigns", {
        method: "POST",
        body: campaignRequest(input),
      });
      setData((prev) => ({
        campaigns: [campaign, ...prev.campaigns.filter((c) => c.id !== campaign.id)],
      }));
      markCampaignsChanged();
      return campaign;
    },
    [authenticatedRequest],
  );

  const createDraftCampaign = useCallback(
    async (input: CampaignInput) => {
      setError("");
      const campaign = await authenticatedRequest<BrandCampaign>("/api/campaigns/drafts", {
        method: "POST",
        body: campaignRequest({ ...input, status: "draft" }),
      });
      setData((prev) => ({
        campaigns: [campaign, ...prev.campaigns.filter((c) => c.id !== campaign.id)],
      }));
      markCampaignsChanged();
      return campaign;
    },
    [authenticatedRequest],
  );

  const updateCampaign = useCallback(
    async (id: string, input: CampaignInput) => {
      setError("");
      const campaign = await authenticatedRequest<BrandCampaign>(`/api/campaigns/${id}`, {
        method: "PUT",
        body: campaignRequest(input),
      });
      setData((prev) => ({
        campaigns: prev.campaigns.map((c) => (c.id === id ? campaign : c)),
      }));
      markCampaignsChanged();
      return campaign;
    },
    [authenticatedRequest],
  );

  const updateDraftCampaign = useCallback(
    async (id: string, input: CampaignInput) => {
      setError("");
      const campaign = await authenticatedRequest<BrandCampaign>(`/api/campaigns/${id}/draft`, {
        method: "PUT",
        body: campaignRequest({ ...input, status: "draft" }),
      });
      setData((prev) => ({
        campaigns: prev.campaigns.map((c) => (c.id === id ? campaign : c)),
      }));
      markCampaignsChanged();
      return campaign;
    },
    [authenticatedRequest],
  );

  const uploadCampaignFile = useCallback(
    async (campaignId: string, file: File) => {
      setError("");
      const body = new FormData();
      body.append("file", file);
      const meta = await authenticatedRequest<BrandCampaignFile>(
        `/api/campaigns/${campaignId}/files`,
        { method: "POST", body },
      );
      setData((prev) => ({
        campaigns: prev.campaigns.map((campaign) =>
          campaign.id === campaignId
            ? {
                ...campaign,
                files: [
                  meta,
                  ...campaign.files.filter((existing) => existing.id !== meta.id),
                ],
              }
            : campaign,
        ),
      }));
      markCampaignsChanged();
      return meta;
    },
    [authenticatedRequest],
  );

  const deleteCampaignFile = useCallback(
    async (campaignId: string, fileId: string) => {
      setError("");
      await authenticatedRequest<{ deleted: true }>(
        `/api/campaigns/${campaignId}/files/${fileId}`,
        { method: "DELETE" },
      );
      setData((prev) => ({
        campaigns: prev.campaigns.map((campaign) =>
          campaign.id === campaignId
            ? {
                ...campaign,
                files: campaign.files.filter((file) => file.id !== fileId),
              }
            : campaign,
        ),
      }));
      markCampaignsChanged();
    },
    [authenticatedRequest],
  );

  return {
    data,
    ready,
    error,
    reload,
    createCampaign,
    createDraftCampaign,
    updateCampaign,
    updateDraftCampaign,
    uploadCampaignFile,
    deleteCampaignFile,
  };
}

export async function downloadCampaignFile(
  authenticatedBinaryRequest: AuthenticatedBinaryRequest,
  campaignId: string,
  file: BrandCampaignFile,
) {
  const result = await authenticatedBinaryRequest(
    `/api/campaigns/${campaignId}/files/${file.id}/download`,
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

export function getCampaignById(
  data: BrandCampaignData,
  id: string,
): BrandCampaign | undefined {
  return data.campaigns.find((c) => c.id === id);
}

export function getBrandDashboardMetrics(data: BrandCampaignData) {
  const active = data.campaigns.filter((c) => c.status === "active");
  const draft = data.campaigns.filter((c) => c.status === "draft");
  // Drafts can have postToMarketplace=true as intent ("when published") but are
  // not listed on the marketplace until status is active (or later lifecycle).
  const posted = data.campaigns.filter(
    (c) => c.postToMarketplace && c.status === "active",
  );
  return {
    total: data.campaigns.length,
    active: active.length,
    draft: draft.length,
    posted: posted.length,
    closingSoon: active.filter((c) => c.endDate <= "2026-08-01").length,
  };
}

export function campaignMarketplaceLabel(campaign: BrandCampaign): string {
  if (!campaign.postToMarketplace) return "Private";
  if (campaign.status === "draft") return "When published";
  if (campaign.status === "active") return "Posted";
  return "Closed";
}
