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

export type CampaignInput = Omit<BrandCampaign, "id" | "createdAt" | "updatedAt">;

const EMPTY_DATA: BrandCampaignData = { campaigns: [] };

export function useBrandCampaigns(authenticatedRequest: AuthenticatedRequest) {
  const [data, setData] = useState<BrandCampaignData>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<BrandCampaignData>("/api/campaigns");
    setData(next);
    return next;
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<BrandCampaignData>("/api/campaigns")
      .then((next) => {
        if (active) setData(next);
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

  const createCampaign = useCallback(
    async (input: CampaignInput) => {
      setError("");
      const campaign = await authenticatedRequest<BrandCampaign>("/api/campaigns", {
        method: "POST",
        body: input,
      });
      setData((prev) => ({
        campaigns: [campaign, ...prev.campaigns.filter((c) => c.id !== campaign.id)],
      }));
      return campaign;
    },
    [authenticatedRequest],
  );

  const updateCampaign = useCallback(
    async (id: string, input: CampaignInput) => {
      setError("");
      const campaign = await authenticatedRequest<BrandCampaign>(`/api/campaigns/${id}`, {
        method: "PUT",
        body: input,
      });
      setData((prev) => ({
        campaigns: prev.campaigns.map((c) => (c.id === id ? campaign : c)),
      }));
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
    },
    [authenticatedRequest],
  );

  return {
    data,
    ready,
    error,
    reload,
    createCampaign,
    updateCampaign,
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
  const posted = data.campaigns.filter((c) => c.postToMarketplace);
  return {
    total: data.campaigns.length,
    active: active.length,
    draft: draft.length,
    posted: posted.length,
    closingSoon: active.filter((c) => c.endDate <= "2026-08-01").length,
  };
}
