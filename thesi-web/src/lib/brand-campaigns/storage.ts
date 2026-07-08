"use client";

import { useCallback, useEffect, useState } from "react";
import { SEED_BRAND_CAMPAIGN_DATA } from "./seed";
import type { BrandCampaign, BrandCampaignData } from "./types";

const STORAGE_KEY = "thesi_brand_campaigns";

export function loadBrandCampaignData(): BrandCampaignData {
  if (typeof window === "undefined") return SEED_BRAND_CAMPAIGN_DATA;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_BRAND_CAMPAIGN_DATA));
    return SEED_BRAND_CAMPAIGN_DATA;
  }
  try {
    return JSON.parse(raw) as BrandCampaignData;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_BRAND_CAMPAIGN_DATA));
    return SEED_BRAND_CAMPAIGN_DATA;
  }
}

export function saveBrandCampaignData(data: BrandCampaignData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useBrandCampaigns() {
  const [data, setData] = useState<BrandCampaignData>(SEED_BRAND_CAMPAIGN_DATA);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setData(loadBrandCampaignData());
    setReady(true);
  }, []);

  const persist = useCallback((next: BrandCampaignData) => {
    setData(next);
    saveBrandCampaignData(next);
  }, []);

  return { data, ready, persist };
}

export function getCampaignById(data: BrandCampaignData, id: string): BrandCampaign | undefined {
  return data.campaigns.find((c) => c.id === id);
}

export function createBrandCampaign(
  data: BrandCampaignData,
  campaign: Omit<BrandCampaign, "id" | "createdAt" | "updatedAt">,
): { data: BrandCampaignData; campaign: BrandCampaign } {
  const now = new Date().toISOString();
  const newCampaign: BrandCampaign = {
    ...campaign,
    id: `campaign-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };
  return {
    data: { campaigns: [...data.campaigns, newCampaign] },
    campaign: newCampaign,
  };
}

export function updateBrandCampaign(
  data: BrandCampaignData,
  id: string,
  patch: Partial<BrandCampaign>,
): BrandCampaignData {
  return {
    campaigns: data.campaigns.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c,
    ),
  };
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

