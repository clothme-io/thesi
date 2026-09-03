import { describe, expect, it } from "vitest";
import {
  draftFormFromCampaign,
  draftFormToInput,
} from "@/components/brand/campaigns/DraftCampaignEditForm";
import type { BrandCampaign } from "@/lib/brand-campaigns/types";

function campaign(overrides: Partial<BrandCampaign> = {}): BrandCampaign {
  return {
    id: "c1",
    name: "Waitlist",
    campaignType: "growth",
    contentTypes: ["instagram_reels"],
    status: "draft",
    startDate: "2026-08-27",
    endDate: "2026-10-15",
    brief: "Brief",
    deliverables: "Reels",
    exampleVideoLinks: [],
    requirements: {
      niches: ["Lifestyle"],
      minFollowersRange: "5k+",
      location: "US",
      platforms: ["Instagram"],
    },
    files: [],
    payment: {
      model: "milestone",
      milestones: [
        {
          id: "m1",
          label: "Script approved",
          trigger: "On brief sign-off",
          amountCents: 20000,
        },
        {
          id: "m2",
          label: "Reel live",
          trigger: "Posted and tagged",
          amountCents: 40000,
        },
      ],
      notes: "Paid in 5 days",
    },
    postToMarketplace: true,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
    ...overrides,
  };
}

describe("draft form milestone round-trip", () => {
  it("preserves structured milestones instead of flattening to a base amount", () => {
    const form = draftFormFromCampaign(campaign());
    expect(form.paymentModel).toBe("milestone");
    expect(form.milestones.map((row) => row.label)).toEqual([
      "Script approved",
      "Reel live",
    ]);
    expect(draftFormToInput(form).payment).toEqual({
      model: "milestone",
      notes: "Paid in 5 days",
      milestones: [
        {
          id: "m1",
          label: "Script approved",
          trigger: "On brief sign-off",
          amountCents: 20000,
        },
        {
          id: "m2",
          label: "Reel live",
          trigger: "Posted and tagged",
          amountCents: 40000,
        },
      ],
    });
  });
});
