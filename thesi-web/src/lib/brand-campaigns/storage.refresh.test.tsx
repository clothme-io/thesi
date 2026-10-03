import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useBrandCampaigns } from "./storage";
import { EMPTY_CREATOR_BENEFITS, type BrandCampaign } from "./types";

const draftCampaign: BrandCampaign = {
  id: "campaign-draft-1",
  name: "Introduce ClothME",
  campaignType: "experience",
  contentTypes: ["tiktok"],
  status: "draft",
  startDate: "2026-10-03",
  endDate: "2026-11-03",
  brief: "",
  deliverables: "",
  description: null,
  exampleVideoLinks: [],
  requirements: {
    niches: [],
    minFollowersRange: "",
    location: "",
    platforms: [],
  },
  files: [],
  payment: { model: "commission" },
  requiredTasks: [],
  creatorBenefits: { ...EMPTY_CREATOR_BENEFITS },
  contentRights: {
    organicUsage: true,
    websiteAppUsage: false,
    paidAdsUsage: false,
    duration: "",
    rawContentAccess: false,
  },
  productsProvided: [],
  postToMarketplace: false,
  createdAt: "2026-10-02T00:00:00.000Z",
  updatedAt: "2026-10-02T00:00:00.000Z",
};

describe("useBrandCampaigns refresh", () => {
  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("reloads a stale campaign list when another route saves a draft", async () => {
    const authenticatedRequest = vi
      .fn()
      .mockResolvedValueOnce({ campaigns: [] })
      .mockResolvedValueOnce({ campaigns: [draftCampaign] });

    const { result } = renderHook(() =>
      useBrandCampaigns(authenticatedRequest),
    );

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.data.campaigns).toEqual([]);

    act(() => {
      sessionStorage.setItem("thesi_campaigns_changed_at", "1");
      window.dispatchEvent(new Event("thesi:campaigns-changed"));
    });

    await waitFor(() =>
      expect(result.current.data.campaigns).toEqual([draftCampaign]),
    );
    expect(sessionStorage.getItem("thesi_campaigns_changed_at")).toBeNull();
  });
});
