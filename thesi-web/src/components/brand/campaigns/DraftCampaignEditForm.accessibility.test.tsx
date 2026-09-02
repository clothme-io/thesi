import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  draftFormFromCampaign,
  DraftCampaignEditForm,
} from "@/components/brand/campaigns/DraftCampaignEditForm";
import type { BrandCampaign } from "@/lib/brand-campaigns/types";

function campaign(): BrandCampaign {
  return {
    id: "c1",
    name: "Waitlist",
    campaignType: "growth",
    type: "instagram_reels",
    status: "draft",
    startDate: "2026-08-27",
    endDate: "2026-10-15",
    brief: "Brief",
    deliverables: "Reels",
    exampleVideoLinks: ["https://example.com"],
    requirements: {
      niches: ["Lifestyle"],
      minFollowersRange: "5k+",
      location: "US",
      platforms: ["Instagram"],
    },
    files: [],
    payment: {
      model: "flat_rate",
      flatRateCents: 20000,
      notes: "Paid in 5 days",
    },
    postToMarketplace: true,
    createdAt: "2026-08-27T00:00:00.000Z",
    updatedAt: "2026-08-27T00:00:00.000Z",
  };
}

describe("DraftCampaignEditForm field handles", () => {
  afterEach(() => {
    cleanup();
  });

  it("exposes stable names and updates date fields through accessible labels", async () => {
    const form = draftFormFromCampaign(campaign());
    const onChange = vi.fn();

    render(
      <DraftCampaignEditForm
        campaign={campaign()}
        form={form}
        onChange={onChange}
        pendingFiles={[]}
        onPendingFiles={vi.fn()}
      />,
    );

    const startDate = screen.getByLabelText("Start date");
    expect(startDate).toHaveAttribute("name", "campaignStartDate");
    expect(startDate).toHaveAttribute("data-testid", "campaign-start-date-input");

    fireEvent.change(startDate, { target: { value: "2026-09-10" } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ startDate: "2026-09-10" }),
    );
  });
});
