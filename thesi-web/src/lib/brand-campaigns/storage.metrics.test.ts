import { describe, expect, it } from "vitest";
import type { BrandCampaign } from "./types";
import {
  campaignMarketplaceLabel,
  getBrandDashboardMetrics,
} from "./storage";

function campaign(overrides: Partial<BrandCampaign> = {}): BrandCampaign {
  return {
    id: "c1",
    name: "Test",
    campaignType: "product",
    contentTypes: ["tiktok"],
    status: "draft",
    startDate: "2026-08-14",
    endDate: "2026-09-14",
    brief: "Brief",
    deliverables: "Videos",
    exampleVideoLinks: [],
    requirements: {
      niches: [],
      minFollowersRange: "1k+",
      location: "US",
      platforms: ["TikTok"],
    },
    files: [],
    payment: { model: "flat_rate", flatRateCents: 0 },
    postToMarketplace: true,
    createdAt: "2026-08-14T00:00:00.000Z",
    updatedAt: "2026-08-14T00:00:00.000Z",
    ...overrides,
  };
}

describe("brand dashboard marketplace metrics", () => {
  it("does not count drafts as posted to marketplace", () => {
    const metrics = getBrandDashboardMetrics({
      campaigns: [
        campaign({ id: "draft", status: "draft", postToMarketplace: true }),
        campaign({
          id: "active",
          status: "active",
          postToMarketplace: true,
        }),
      ],
    });

    expect(metrics.posted).toBe(1);
    expect(metrics.draft).toBe(1);
    expect(metrics.active).toBe(1);
  });

  it("labels draft marketplace intent separately from Posted", () => {
    expect(
      campaignMarketplaceLabel(
        campaign({ status: "draft", postToMarketplace: true }),
      ),
    ).toBe("When published");
    expect(
      campaignMarketplaceLabel(
        campaign({ status: "active", postToMarketplace: true }),
      ),
    ).toBe("Posted");
    expect(
      campaignMarketplaceLabel(
        campaign({ status: "paused", postToMarketplace: true }),
      ),
    ).toBe("Closed");
    expect(
      campaignMarketplaceLabel(
        campaign({ status: "completed", postToMarketplace: true }),
      ),
    ).toBe("Closed");
  });

  it("does not count paused or completed campaigns as posted", () => {
    const metrics = getBrandDashboardMetrics({
      campaigns: [
        campaign({ id: "paused", status: "paused", postToMarketplace: true }),
        campaign({
          id: "completed",
          status: "completed",
          postToMarketplace: true,
        }),
        campaign({ id: "active", status: "active", postToMarketplace: true }),
      ],
    });

    expect(metrics.posted).toBe(1);
  });
});
