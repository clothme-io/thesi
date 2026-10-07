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
import { formPaymentModel } from "./commission";

const form = () => ({
  ...defaultHybridPaymentForm(),
  baseAmount: "200.50",
  affiliatePercent: "12.25",
  affiliateTerms:
    "Net product sales excluding tax, shipping, and refunds. Monthly settlement after 30 days.",
});

describe("Commission with optional base", () => {
  it('uses agreed brand funding and ClothME handling instead of stale proposals',()=>{
    const hybrid={...form(),commissionFundingSource:'shared_custom' as const,commissionFundingTerms:'Brand funds 70%; ClothME contribution requires approval.'};
    const payment=buildCampaignPayment({model:'commission',flatAmount:'',milestoneStructure:'cumulative',notes:'',milestones:[],hybrid});
    expect(payment.hybrid?.affiliate?.payoutHandler).toBe('clothme');
    expect(payment.hybrid?.affiliate?.fundingSource).toBe('brand');
    const campaign={...SEED_BRAND_CAMPAIGN_DATA.campaigns[0],payment};
    expect(draftFormToInput(draftFormFromCampaign(campaign)).payment).toEqual({
      ...payment,
      model: "product_commission",
    });
    expect(payment.hybrid?.affiliate?.fundingFlowVersion).toBe(1);
    expect(paymentFormError('commission',[],{...hybrid,commissionFundingTerms:''})).toBeNull();
  });
  it("round-trips commission only and ignores stale disabled base fields", () => {
    const hybrid = {...form(),baseEnabled:false,baseAmount:"999",baseTrigger:"custom" as const,baseCustomTrigger:""};
    expect(paymentFormError("commission",[],hybrid)).toBeNull();
    const payment = buildCampaignPayment({model:"commission",flatAmount:"",milestoneStructure:"cumulative",notes:"",milestones:[],hybrid});
    expect(payment.hybrid?.base).toBeUndefined();
    const campaign = {...SEED_BRAND_CAMPAIGN_DATA.campaigns[0],payment};
    expect(draftFormToInput(draftFormFromCampaign(campaign)).payment).toEqual({
      ...payment,
      model: "product_commission",
    });
    expect(formPayoutCents("commission","999",[],"cumulative",hybrid)).toBe(0);
    expect(getCampaignBudgetLabel(campaign)).toContain("Commission only: 12.25%");
    expect(formatListingPayment(campaignToListing(campaign,"Brand","brand-1").payment)).not.toContain("base per creator");
  });
  it.each(["", "0"])("allows optional base amount %s", (baseAmount) => {
    const hybrid = { ...form(), baseAmount };
    expect(paymentFormError("commission", [], hybrid)).toBeNull();
    const payment = buildCampaignPayment({
      model: "commission",
      flatAmount: "",
      milestoneStructure: "cumulative",
      notes: "",
      milestones: [],
      hybrid,
    });
    expect(payment.hybrid?.base?.amountCents).toBe(0);
    expect(formPayoutCents("commission", "999", [], "cumulative", hybrid)).toBe(0);
  });
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
    expect(restored.payment).toEqual({ ...payment, model: "product_commission" });
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

  it.each(["-200", "200.123", "abc", "21474836.48"])(
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
    ).toMatch(/attributed product sale/i);
    expect(
      paymentFormError("commission", [], {
        ...form(),
        affiliateType: "fixed_amount_per_install",
      }),
    ).toMatch(/conversion event/i);
    expect(
      paymentFormError("commission", [], {
        ...form(),
        affiliateAttributionDays: "1.5",
      }),
    ).toMatch(/attribution/i);
    expect(
      paymentFormError("commission", [], { ...form(), baseTrigger: "custom" }),
    ).toBeNull();
    expect(
      paymentFormError("commission", [], { ...form(), affiliateTerms: " " }),
    ).toMatch(/settlement/i);
  });

  it("does not send Merchant products or a prepaid install pool for install campaigns", () => {
    const hybrid = {
      ...form(),
      affiliateType: "fixed_amount_per_install" as const,
      installEventAmounts: { verified_account: "2.00" },
    };
    const payment = buildCampaignPayment({
      model: "commission",
      flatAmount: "",
      milestoneStructure: "cumulative",
      notes: "",
      milestones: [],
      hybrid,
    });
    expect(payment.hybrid?.affiliate?.fundingTerms).toMatch(/does not collect a prepaid install pool/i);
    const campaign = {
      ...SEED_BRAND_CAMPAIGN_DATA.campaigns[0],
      payment,
    };
    const input = draftFormToInput({
      ...draftFormFromCampaign(campaign),
      merchantProducts: [{ productId: "should-not-publish", variantIds: ["v1"] }],
    });
    expect(input.merchantProducts ?? []).toEqual([]);
    expect(input.merchantProductId ?? null).toBeNull();
    expect(input.payment.model).toBe("app_install");
  });

  it("maps legacy commission to first-class product commission and app install", () => {
    expect(
      formPaymentModel({
        model: "commission",
        hybrid: { affiliate: { commissionType: "percentage_of_sale" } },
      }),
    ).toBe("product_commission");
    expect(
      formPaymentModel({
        model: "commission",
        hybrid: { affiliate: { commissionType: "fixed_amount_per_install" } },
      }),
    ).toBe("app_install");
    expect(formPaymentModel({ model: "product_commission" })).toBe(
      "product_commission",
    );
    expect(formPaymentModel({ model: "app_install" })).toBe("app_install");
    expect(
      buildCampaignPayment({
        model: "product_commission",
        flatAmount: "",
        milestoneStructure: "cumulative",
        notes: "",
        milestones: [],
        hybrid: form(),
      }).model,
    ).toBe("product_commission");
    expect(
      buildCampaignPayment({
        model: "app_install",
        flatAmount: "",
        milestoneStructure: "cumulative",
        notes: "",
        milestones: [],
        hybrid: {
          ...form(),
          affiliateType: "percentage_of_sale",
          installEventAmounts: { verified_account: "2.00" },
        },
      }),
    ).toMatchObject({
      model: "app_install",
      hybrid: {
        affiliate: {
          commissionType: "fixed_amount_per_install",
          installApp: "customer",
          conversions: [{ event: "verified_account", amountCents: 200 }],
        },
      },
    });
  });

  it("allows mixed paid and unpaid install conversion events", () => {
    const hybrid = {
      ...form(),
      affiliateType: "fixed_amount_per_install" as const,
      installEventAmounts: {
        verified_account: "1.00",
        fit_profile_completed: "",
        first_purchase: "0",
      },
    };
    expect(paymentFormError("app_install", [], hybrid)).toBeNull();
    expect(
      buildCampaignPayment({
        model: "app_install",
        flatAmount: "",
        milestoneStructure: "cumulative",
        notes: "",
        milestones: [],
        hybrid,
      }).hybrid?.affiliate?.conversions,
    ).toEqual([
      { event: "verified_account", amountCents: 100 },
      { event: "fit_profile_completed" },
      { event: "first_purchase" },
    ]);
  });
});
