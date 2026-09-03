import { describe, expect, it } from "vitest";
import {
  canCreatorApplyToListing,
  getBrowseListingsForCreator,
  getEffectiveListingStatus,
} from "./listings";
import type { MarketplaceListing } from "./types";

const baseListing: MarketplaceListing = {
  id: "listing-1",
  name: "QA listing",
  brandName: "QA Brand",
  ownerUserId: "brand-1",
  campaignId: "campaign-1",
  campaignType: "experience",
  contentTypes: ["tiktok"],
  status: "open",
  startDate: "2026-09-01",
  endDate: "2099-09-30",
  applicationDeadline: "2099-09-15",
  brief: "Brief",
  deliverables: "1 video",
  exampleVideoLinks: [],
  requirements: [],
  files: [],
  payment: { structure: "flat_rate", currency: "USD", flatAmountCents: 50000 },
  location: "Remote",
  remoteOk: true,
  slots: 5,
  applicantsCount: 0,
  postedAt: "2026-09-01T00:00:00.000Z",
};

describe("marketplace listing availability", () => {
  it("treats listings past the application deadline as closed for creators", () => {
    const expired = { ...baseListing, applicationDeadline: "2026-09-01" };

    expect(getEffectiveListingStatus(expired, "2026-09-02")).toBe("closed");
    expect(canCreatorApplyToListing(expired, "2026-09-02")).toBe(false);
    expect(
      getBrowseListingsForCreator([baseListing, expired]).map(
        (listing) => listing.id,
      ),
    ).toEqual(["listing-1"]);
  });
});
