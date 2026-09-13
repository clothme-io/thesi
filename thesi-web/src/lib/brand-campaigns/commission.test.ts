import { describe, expect, it } from "vitest";
import {
  buildCampaignPayment,
  defaultHybridPaymentForm,
  formPayoutCents,
  paymentFormError,
} from "./payment-form";
import {
  draftFormFromCampaign,
  draftFormToInput,
} from "@/components/brand/campaigns/DraftCampaignEditForm";
import { SEED_BRAND_CAMPAIGN_DATA } from "./seed";
import { campaignToListing } from "@/lib/marketplace/listings";
import { formatListingPayment } from "@/lib/marketplace/types";
import { getCampaignBudgetLabel } from "./types";

const form = () => ({
  ...defaultHybridPaymentForm(),
  baseAmount: "200.50",
  affiliatePercent: "12.25",
  affiliateTerms:
    "Net product sales excluding tax, shipping, and refunds. Monthly settlement after 30 days.",
});

describe("Base + Commission", () => {
  it("preserves terms through editing and marketplace mapping without including stale hybrid bonuses", () => {
    const hybrid = {
      ...form(),
      milestonesEnabled: true,
      creatorPoolEnabled: true,
      creatorPoolAmount: "500",
    };
    const payment = buildCampaignPayment({
      model: "commission",
      flatAmount: "999",
      milestoneStructure: "cumulative",
      notes: "Agreed terms",
      milestones: [],
      hybrid,
    });
    const campaign = { ...SEED_BRAND_CAMPAIGN_DATA.campaigns[0], payment };
    const restored = draftFormToInput(draftFormFromCampaign(campaign));
    expect(restored.payment).toEqual(payment);
    expect(payment.hybrid?.base?.amountCents).toBe(20050);
    expect(payment.hybrid?.affiliate?.commissionPercent).toBe(12.25);
    expect(payment.hybrid?.milestones).toBeUndefined();
    expect(payment.hybrid?.creatorPool).toBeUndefined();
    const listing = campaignToListing(campaign, "Brand", "brand-1");
    expect(listing.payment.structure).toBe("commission");
    expect(listing.payment.hybrid).toEqual(payment.hybrid);
    expect(formatListingPayment(listing.payment)).toBe(
      getCampaignBudgetLabel(campaign),
    );
    expect(formatListingPayment(listing.payment)).toContain(
      "$200.50 base per creator + 12.25% of eligible sales",
    );
    expect(formPayoutCents("commission", "999", [], "cumulative", hybrid)).toBe(
      20050,
    );
  });

  it.each(["-10", "0", "100.01", "10.123", "NaN", "10abc"])(
    "rejects invalid commission rate %s",
    (affiliatePercent) => {
      expect(
        paymentFormError("commission", [], { ...form(), affiliatePercent }),
      ).toMatch(/commission rate/i);
    },
  );

  it.each(["-200", "0", "200.123", "abc", "21474836.48"])(
    "rejects invalid base amount %s",
    (baseAmount) => {
      expect(
        paymentFormError("commission", [], { ...form(), baseAmount }),
      ).toMatch(/base payment/i);
    },
  );

  it("rejects invalid form values before serialization, including draft saves", () => {
    expect(() =>
      buildCampaignPayment({
        model: "commission",
        flatAmount: "",
        milestoneStructure: "highest_achieved",
        notes: "",
        milestones: [],
        hybrid: { ...form(), baseAmount: "-200" },
      }),
    ).toThrow(/base payment/i);
  });

  it("requires the basis, attribution window, custom trigger and eligibility terms", () => {
    expect(paymentFormError("commission", [], form())).toBeNull();
    expect(
      paymentFormError("commission", [], {
        ...form(),
        affiliateType: "fixed_amount_per_sale",
      }),
    ).toMatch(/commission base/i);
    expect(
      paymentFormError("commission", [], {
        ...form(),
        affiliateAttributionDays: "1.5",
      }),
    ).toMatch(/attribution/i);
    expect(
      paymentFormError("commission", [], { ...form(), baseTrigger: "custom" }),
    ).toMatch(/earned/i);
    expect(
      paymentFormError("commission", [], { ...form(), affiliateTerms: " " }),
    ).toMatch(/settlement/i);
  });
});
