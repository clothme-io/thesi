import { DEFAULT_COMMISSION_RULES,assertCommissionRules,type CommissionRules } from './commission-rules';
import {
  eventsForInstallApp,
  isInstallApp,
  isInstallConversionEvent,
  type InstallApp,
  type InstallConversion,
  type InstallConversionEvent,
} from "./install-conversions";
import type {
  BrandCampaign,
  BrandCampaignHybridPayment,
  BrandCampaignHybridAffiliateType,
  BrandCampaignHybridBaseTrigger,
  BrandCampaignHybridMetric,
  BrandCampaignHybridMilestoneAmountType,
  BrandCampaignHybridPoolDistribution,
  BrandCampaignHybridPoolSettlement,
  BrandCampaignMilestone,
  BrandCampaignMilestoneStructure,
  BrandCampaignPaymentModel,
} from "./types";

export const MAX_MILESTONES = 10;
export const DEFAULT_MILESTONE_STRUCTURE: BrandCampaignMilestoneStructure =
  "highest_achieved";

export type MilestoneFormRow = {
  id: string;
  label: string;
  trigger: string;
  amount: string;
};

export type HybridPoolMetricFormRow = {
  id: string;
  name: string;
  weightPercent: string;
};

export type HybridPaymentFormState = {
  commissionRules?: CommissionRules;
  baseEnabled: boolean;
  baseAmount: string;
  baseTrigger: BrandCampaignHybridBaseTrigger;
  baseCustomTrigger: string;
  milestonesEnabled: boolean;
  milestoneMetric: BrandCampaignHybridMetric;
  milestoneCustomMetric: string;
  milestoneStructure: BrandCampaignMilestoneStructure;
  milestoneAmountType: BrandCampaignHybridMilestoneAmountType;
  milestoneRows: MilestoneFormRow[];
  affiliateEnabled: boolean;
  commissionPayoutHandler: 'clothme'|'brand';
  commissionFundingSource: ''|'brand'|'clothme'|'shared_custom';
  commissionFundingTerms: string;
  affiliateType: BrandCampaignHybridAffiliateType;
  affiliatePercent: string;
  affiliateFixedAmount: string;
  installApp: InstallApp;
  installEventAmounts: Partial<Record<InstallConversionEvent, string>>;
  installListedProductCount: string;
  affiliateAttributionDays: string;
  affiliateTerms: string;
  creatorPoolEnabled: boolean;
  creatorPoolAmount: string;
  creatorPoolGoal: string;
  creatorPoolDistribution: BrandCampaignHybridPoolDistribution;
  creatorPoolCustomDistribution: string;
  creatorPoolMetrics: HybridPoolMetricFormRow[];
  creatorPoolSettlement: BrandCampaignHybridPoolSettlement;
  creatorPoolSettlementDays: string;
  creatorPoolRules: string;
};

export function newMilestoneId(): string {
  return globalThis.crypto?.randomUUID?.()
    ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function parseMoneyToCents(raw: string): number {
  const num = Number(raw.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(num)) return 0;
  return Math.round(num * 100);
}

function isOptionalNonNegativeMoney(raw: string): boolean {
  const value = raw.trim();
  return (
    value === "" ||
    (/^\$?\d+(?:\.\d{1,2})?$/.test(value) &&
      parseMoneyToCents(value) >= 0 &&
      parseMoneyToCents(value) <= 2_147_483_647)
  );
}

export function centsToInput(cents?: number): string {
  if (!cents) return "";
  const dollars = cents / 100;
  return `$${Number.isInteger(dollars) ? dollars : dollars.toFixed(2)}`;
}

export function emptyMilestoneRow(): MilestoneFormRow {
  return { id: newMilestoneId(), label: "", trigger: "", amount: "" };
}

export function defaultMilestoneRows(): MilestoneFormRow[] {
  return [
    {
      id: newMilestoneId(),
      label: "Kickoff",
      trigger: "Contract signed",
      amount: "",
    },
    {
      id: newMilestoneId(),
      label: "Draft delivered",
      trigger: "First draft approved",
      amount: "",
    },
    {
      id: newMilestoneId(),
      label: "Final approved",
      trigger: "Final deliverable approved",
      amount: "",
    },
  ];
}

export function defaultHybridMilestoneRows(): MilestoneFormRow[] {
  return [
    {
      id: newMilestoneId(),
      label: "Starter milestone",
      trigger: "First verified performance threshold",
      amount: "",
    },
    {
      id: newMilestoneId(),
      label: "Stretch milestone",
      trigger: "Highest verified performance threshold",
      amount: "",
    },
  ];
}

export function defaultHybridPoolMetrics(): HybridPoolMetricFormRow[] {
  return [
    { id: newMilestoneId(), name: "Impact Score", weightPercent: "40" },
    { id: newMilestoneId(), name: "Fit Profiles", weightPercent: "30" },
    { id: newMilestoneId(), name: "Engagement", weightPercent: "20" },
    { id: newMilestoneId(), name: "Participation", weightPercent: "10" },
  ];
}

export function defaultHybridPaymentForm(): HybridPaymentFormState {
  return {
    baseEnabled: true,
    baseAmount: "",
    baseTrigger: "content_accepted",
    baseCustomTrigger: "",
    milestonesEnabled: false,
    milestoneMetric: "views",
    milestoneCustomMetric: "",
    milestoneStructure: DEFAULT_MILESTONE_STRUCTURE,
    milestoneAmountType: "bonus_in_addition_to_base",
    milestoneRows: defaultHybridMilestoneRows(),
    commissionRules:process.env.NEXT_PUBLIC_COMMISSION_RULES_ENABLED==='true'?{...DEFAULT_COMMISSION_RULES}:undefined,
    affiliateEnabled: false,
    commissionPayoutHandler: 'clothme',
    commissionFundingSource: '',
    commissionFundingTerms: '',
    affiliateType: "percentage_of_sale",
    affiliatePercent: "",
    affiliateFixedAmount: "",
    installApp: "customer",
    installEventAmounts: {},
    installListedProductCount: "",
    affiliateAttributionDays: "30",
    affiliateTerms: "",
    creatorPoolEnabled: false,
    creatorPoolAmount: "",
    creatorPoolGoal: "",
    creatorPoolDistribution: "impact_score",
    creatorPoolCustomDistribution: "",
    creatorPoolMetrics: defaultHybridPoolMetrics(),
    creatorPoolSettlement: "campaign_end",
    creatorPoolSettlementDays: "30",
    creatorPoolRules: "",
  };
}

export function isBlankMilestoneRow(row: MilestoneFormRow): boolean {
  return !row.label.trim() && !row.trigger.trim() && !row.amount.trim();
}

export function milestonesToFormRows(
  milestones?: BrandCampaignMilestone[],
): MilestoneFormRow[] {
  if (!milestones?.length) return defaultMilestoneRows();
  return milestones.map((milestone) => ({
    id: milestone.id || newMilestoneId(),
    label: milestone.label,
    trigger: milestone.trigger,
    amount: centsToInput(milestone.amountCents),
  }));
}

export function completeMilestoneRows(
  rows: MilestoneFormRow[],
): BrandCampaignMilestone[] {
  return rows
    .map((row) => ({
      id: row.id || newMilestoneId(),
      label: row.label.trim(),
      trigger: row.trigger.trim(),
      amountCents: parseMoneyToCents(row.amount),
    }))
    .filter(
      (milestone) =>
        Boolean(milestone.label) &&
        Boolean(milestone.trigger) &&
        milestone.amountCents > 0,
    );
}

function parsePercent(raw: string): number | undefined {
  const value = Number(raw.replace(/[^0-9.]/g, ""));
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parsePositiveInt(raw: string): number | undefined {
  const value = Number(raw.replace(/[^0-9]/g, ""));
  return Number.isFinite(value) && value > 0 ? Math.round(value) : undefined;
}

function installEventAmountsFromPayment(
  conversions?: InstallConversion[],
): Partial<Record<InstallConversionEvent, string>> {
  const amounts: Partial<Record<InstallConversionEvent, string>> = {};
  for (const row of conversions ?? []) {
    if (!isInstallConversionEvent(row.event)) continue;
    amounts[row.event] = row.amountCents ? centsToInput(row.amountCents) : "";
  }
  return amounts;
}

export function completeInstallConversions(
  form: HybridPaymentFormState,
): InstallConversion[] {
  const allowed = eventsForInstallApp(form.installApp);
  return allowed.flatMap((event) => {
    if (!(event in form.installEventAmounts)) return [];
    const amount = parseMoneyToCents(form.installEventAmounts[event] ?? "");
    const listed =
      event === "x_products_listed"
        ? parsePositiveInt(form.installListedProductCount)
        : undefined;
    return [
      {
        event,
        ...(amount > 0 ? { amountCents: amount } : {}),
        ...(listed ? { listedProductCount: listed } : {}),
      },
    ];
  });
}

export function validateInstallConversions(
  form: HybridPaymentFormState,
): string | null {
  if (!isInstallApp(form.installApp)) {
    return "Choose the Customer or Vendor app for this install campaign.";
  }
  const selected = completeInstallConversions(form);
  if (selected.length === 0) {
    if (parseMoneyToCents(form.affiliateFixedAmount) > 0) return null;
    return "Select at least one app install conversion event.";
  }
  for (const event of Object.keys(form.installEventAmounts) as InstallConversionEvent[]) {
    if (!eventsForInstallApp(form.installApp).includes(event)) {
      return "Conversion events must match the selected Customer or Vendor app.";
    }
    const raw = form.installEventAmounts[event] ?? "";
    if (raw.trim() && (!isOptionalNonNegativeMoney(raw) || parseMoneyToCents(raw) > 2_147_483_647)) {
      return "Leave the earning blank for no payout, or enter a positive USD amount.";
    }
  }
  if ("x_products_listed" in form.installEventAmounts) {
    if (!parsePositiveInt(form.installListedProductCount) || parsePositiveInt(form.installListedProductCount)! > 10_000) {
      return "Set how many listed products qualify for that conversion.";
    }
  }
  return null;
}

export function hybridPaymentToForm(
  payment?: BrandCampaign["payment"],
): HybridPaymentFormState {
  const defaults = defaultHybridPaymentForm();
  const hybrid = payment?.hybrid;
  const baseAmount = hybrid?.base?.amountCents ?? payment?.flatRateCents;
  const affiliatePercent =
    hybrid?.affiliate?.commissionPercent ?? payment?.royaltyPercent;
  return {
    ...defaults,
    baseEnabled: hybrid?.base?.enabled ?? !["commission", "product_commission", "app_install"].includes(payment?.model ?? ""),
    baseAmount: centsToInput(baseAmount),
    baseTrigger: hybrid?.base?.trigger ?? defaults.baseTrigger,
    baseCustomTrigger: hybrid?.base?.customTrigger ?? "",
    milestonesEnabled: hybrid?.milestones?.enabled ?? false,
    milestoneMetric: hybrid?.milestones?.metric ?? defaults.milestoneMetric,
    milestoneCustomMetric: hybrid?.milestones?.customMetric ?? "",
    milestoneStructure:
      hybrid?.milestones?.payoutMethod ?? payment?.milestoneStructure ?? defaults.milestoneStructure,
    milestoneAmountType:
      hybrid?.milestones?.amountType ?? defaults.milestoneAmountType,
    milestoneRows: milestonesToFormRows(hybrid?.milestones?.tiers),
    commissionRules:hybrid?.affiliate?.rules,
    affiliateEnabled: hybrid?.affiliate?.enabled ?? false,
    commissionPayoutHandler: hybrid?.affiliate?.payoutHandler ?? 'clothme',
    commissionFundingSource: hybrid?.affiliate?.fundingSource ?? '',
    commissionFundingTerms: hybrid?.affiliate?.fundingTerms ?? '',
    affiliateType: hybrid?.affiliate?.commissionType ?? defaults.affiliateType,
    affiliatePercent: affiliatePercent ? String(affiliatePercent) : "",
    affiliateFixedAmount: centsToInput(hybrid?.affiliate?.fixedAmountCents),
    installApp: isInstallApp(hybrid?.affiliate?.installApp)
      ? hybrid.affiliate.installApp
      : defaults.installApp,
    installEventAmounts: installEventAmountsFromPayment(hybrid?.affiliate?.conversions),
    installListedProductCount: hybrid?.affiliate?.conversions?.find(
      (row) => row.event === "x_products_listed",
    )?.listedProductCount
      ? String(
          hybrid.affiliate.conversions.find((row) => row.event === "x_products_listed")
            ?.listedProductCount,
        )
      : "",
    affiliateAttributionDays: hybrid?.affiliate?.attributionWindowDays
      ? String(hybrid.affiliate.attributionWindowDays)
      : defaults.affiliateAttributionDays,
    affiliateTerms: hybrid?.affiliate?.terms ?? "",
    creatorPoolEnabled: hybrid?.creatorPool?.enabled ?? false,
    creatorPoolAmount: centsToInput(hybrid?.creatorPool?.poolAmountCents),
    creatorPoolGoal: hybrid?.creatorPool?.campaignGoal ?? "",
    creatorPoolDistribution:
      hybrid?.creatorPool?.distributionMethod ?? defaults.creatorPoolDistribution,
    creatorPoolCustomDistribution:
      hybrid?.creatorPool?.customDistributionMethod ?? "",
    creatorPoolMetrics: hybrid?.creatorPool?.metrics?.length
      ? hybrid.creatorPool.metrics.map((metric) => ({
          id: metric.id || newMilestoneId(),
          name: metric.name,
          weightPercent: String(metric.weightPercent),
        }))
      : defaultHybridPoolMetrics(),
    creatorPoolSettlement:
      hybrid?.creatorPool?.settlementType ?? defaults.creatorPoolSettlement,
    creatorPoolSettlementDays: hybrid?.creatorPool?.settlementDays
      ? String(hybrid.creatorPool.settlementDays)
      : defaults.creatorPoolSettlementDays,
    creatorPoolRules: hybrid?.creatorPool?.rules ?? "",
  };
}

export function completeHybridPayment(
  form: HybridPaymentFormState,
): BrandCampaignHybridPayment {
  const poolMetrics = form.creatorPoolMetrics
    .map((metric) => ({
      id: metric.id || newMilestoneId(),
      name: metric.name.trim(),
      weightPercent: Number(metric.weightPercent.replace(/[^0-9.]/g, "")),
    }))
    .filter((metric) => metric.name && Number.isFinite(metric.weightPercent));

  return {
    base: {
      enabled: form.baseEnabled,
      amountCents: parseMoneyToCents(form.baseAmount),
      currency: "USD",
      trigger: form.baseTrigger,
      ...(form.baseCustomTrigger.trim()
        ? { customTrigger: form.baseCustomTrigger.trim() }
        : {}),
    },
    milestones: {
      enabled: form.milestonesEnabled,
      metric: form.milestoneMetric,
      ...(form.milestoneCustomMetric.trim()
        ? { customMetric: form.milestoneCustomMetric.trim() }
        : {}),
      payoutMethod: form.milestoneStructure,
      amountType: form.milestoneAmountType,
      tiers: completeMilestoneRows(form.milestoneRows),
    },
    affiliate: {
      enabled: form.affiliateEnabled,
      commissionType: form.affiliateType,
      ...(parsePercent(form.affiliatePercent) !== undefined
        ? { commissionPercent: parsePercent(form.affiliatePercent) }
        : {}),
      ...(parseMoneyToCents(form.affiliateFixedAmount) > 0
        ? { fixedAmountCents: parseMoneyToCents(form.affiliateFixedAmount) }
        : {}),
      currency: "USD",
      ...(parsePositiveInt(form.affiliateAttributionDays)
        ? { attributionWindowDays: parsePositiveInt(form.affiliateAttributionDays) }
        : {}),
      ...(form.affiliateTerms.trim() ? { terms: form.affiliateTerms.trim() } : {}),
    },
    creatorPool: {
      enabled: form.creatorPoolEnabled,
      poolAmountCents: parseMoneyToCents(form.creatorPoolAmount),
      currency: "USD",
      ...(form.creatorPoolGoal.trim()
        ? { campaignGoal: form.creatorPoolGoal.trim() }
        : {}),
      distributionMethod: form.creatorPoolDistribution,
      ...(form.creatorPoolCustomDistribution.trim()
        ? { customDistributionMethod: form.creatorPoolCustomDistribution.trim() }
        : {}),
      metrics: poolMetrics,
      settlementType: form.creatorPoolSettlement,
      ...(parsePositiveInt(form.creatorPoolSettlementDays)
        ? { settlementDays: parsePositiveInt(form.creatorPoolSettlementDays) }
        : {}),
      ...(form.creatorPoolRules.trim()
        ? { rules: form.creatorPoolRules.trim() }
        : {}),
    },
  };
}

export function hybridPayoutCents(form: HybridPaymentFormState): number {
  const base = form.baseEnabled ? parseMoneyToCents(form.baseAmount) : 0;
  const milestoneAmounts = form.milestonesEnabled
    ? completeMilestoneRows(form.milestoneRows).map((milestone) => milestone.amountCents)
    : [];
  const milestones =
    form.milestoneStructure === "cumulative"
      ? milestoneAmounts.reduce((sum, amount) => sum + amount, 0)
      : Math.max(0, ...milestoneAmounts);
  return base + milestones;
}

export function validateMilestoneRows(rows: MilestoneFormRow[]): string | null {
  if (completeMilestoneRows(rows).length === 0) {
    return "Add at least one milestone with a label, trigger, and amount.";
  }
  return null;
}

export function paymentFormError(
  model: BrandCampaignPaymentModel,
  milestones: MilestoneFormRow[],
  hybrid?: HybridPaymentFormState,
): string | null {
  if (model === "commission" || model === "product_commission" || model === "app_install") {
    if (!hybrid) return "Configure the commission terms.";
    if (hybrid.baseEnabled && !isOptionalNonNegativeMoney(hybrid.baseAmount)) {
      return "Enter a base payment of 0 or more with at most two decimal places.";
    }
    if(hybrid.commissionRules){try{assertCommissionRules(hybrid.commissionRules);}catch{return 'Check the review period, payout schedule and minimum.';}}
    const rate = Number(hybrid.affiliatePercent);
    if (model === "app_install" && hybrid.affiliateType !== "fixed_amount_per_install") {
      return "App install campaigns pay a fixed amount per qualified install.";
    }
    if (model === "product_commission" && hybrid.affiliateType === "fixed_amount_per_install") {
      return "Product commission campaigns cannot use app install payouts.";
    }
    if (!["percentage_of_sale", "percentage_of_platform_commission", "fixed_amount_per_sale", "fixed_amount_per_install"].includes(hybrid.affiliateType)) {
      return model === "app_install"
        ? "App install campaigns pay a fixed amount per qualified install."
        : "Choose product sale or platform commission as the payout event.";
    }
    if (model === "app_install" || hybrid.affiliateType === "fixed_amount_per_install") {
      const conversionError = validateInstallConversions(hybrid);
      if (conversionError) return conversionError;
    } else if (hybrid.affiliateType === "fixed_amount_per_sale") {
      if (!/^\$?\d+(?:\.\d{1,2})?$/.test(hybrid.affiliateFixedAmount.trim()) || parseMoneyToCents(hybrid.affiliateFixedAmount) <= 0 || parseMoneyToCents(hybrid.affiliateFixedAmount) > 2_147_483_647) {
        return "Enter a positive payout per attributed product sale.";
      }
    } else if (!/^\d+(?:\.\d{1,2})?$/.test(hybrid.affiliatePercent.trim()) || rate <= 0 || rate > 100) {
      return "Enter a commission rate greater than 0 and no more than 100%, with at most two decimal places.";
    }
    if (!/^\d+$/.test(hybrid.affiliateAttributionDays.trim()) || Number(hybrid.affiliateAttributionDays) < 1 || Number(hybrid.affiliateAttributionDays) > 365) {
      return "Enter an attribution window between 1 and 365 days.";
    }
    if (!hybrid.affiliateTerms.trim()) return "Describe eligible sales, refunds, and the settlement schedule.";
    return null;
  }
  if (model === "hybrid") {
    if (!hybrid) return "Configure at least one hybrid compensation component.";
    if (
      !hybrid.baseEnabled &&
      !hybrid.milestonesEnabled &&
      !hybrid.affiliateEnabled &&
      !hybrid.creatorPoolEnabled
    ) {
      return "Turn on at least one hybrid compensation component.";
    }
    if (hybrid.milestonesEnabled) {
      return validateMilestoneRows(hybrid.milestoneRows);
    }
    return null;
  }
  if (model !== "milestone") return null;
  return validateMilestoneRows(milestones);
}

export function seedMilestonesIfNeeded(
  model: BrandCampaignPaymentModel,
  rows: MilestoneFormRow[],
): MilestoneFormRow[] {
  if (model !== "milestone") return rows;
  if (rows.length === 0 || rows.every(isBlankMilestoneRow)) {
    return defaultMilestoneRows();
  }
  return rows;
}

export function formPayoutCents(
  model: BrandCampaignPaymentModel,
  flatAmount: string,
  milestones: MilestoneFormRow[],
  milestoneStructure: BrandCampaignMilestoneStructure = DEFAULT_MILESTONE_STRUCTURE,
  hybrid?: HybridPaymentFormState,
): number {
  if (model === "commission" || model === "product_commission" || model === "app_install") {
    return hybrid?.baseEnabled ? parseMoneyToCents(hybrid.baseAmount) : 0;
  }
  if (model === "hybrid" && hybrid) return hybridPayoutCents(hybrid);
  if (model === "milestone") {
    const amounts = completeMilestoneRows(milestones).map(
      (milestone) => milestone.amountCents,
    );
    if (milestoneStructure === "cumulative") {
      return amounts.reduce((sum, amount) => sum + amount, 0);
    }
    return Math.max(0, ...amounts);
  }
  return parseMoneyToCents(flatAmount);
}

export function buildCampaignPayment(input: {
  model: BrandCampaignPaymentModel;
  flatAmount: string;
  milestoneStructure: BrandCampaignMilestoneStructure;
  notes: string;
  milestones: MilestoneFormRow[];
  hybrid?: HybridPaymentFormState;
}): BrandCampaign["payment"] {
  const notes = input.notes.trim() || undefined;
  if (input.model === "milestone") {
    return {
      model: "milestone",
      milestoneStructure: input.milestoneStructure,
      milestones: completeMilestoneRows(input.milestones),
      ...(notes ? { notes } : {}),
    };
  }
  if (input.model === "commission" || input.model === "product_commission" || input.model === "app_install") {
    const form = {
      ...(input.hybrid ?? defaultHybridPaymentForm()),
      ...(input.model === "app_install"
        ? { affiliateType: "fixed_amount_per_install" as const }
        : {}),
    };
    const error = paymentFormError(input.model, [], form);
    if (error) throw new Error(error);
    const hybrid = completeHybridPayment(form);
    return {
      model: input.model,
      hybrid: {
        ...(form.baseEnabled ? { base: { ...hybrid.base!, enabled: true, trigger: "content_accepted", customTrigger: undefined } } : {}),
        affiliate: { ...hybrid.affiliate!, enabled: true,
          ...(form.affiliateType === "fixed_amount_per_sale"
            ? { commissionPercent: undefined }
            : form.affiliateType === "fixed_amount_per_install"
              ? completeInstallConversions(form).length
                ? {
                    commissionPercent: undefined,
                    fixedAmountCents: undefined,
                    installApp: form.installApp,
                    conversions: completeInstallConversions(form),
                  }
                : { commissionPercent: undefined }
            : { fixedAmountCents: undefined }),
          ...(form.commissionRules?{rules:form.commissionRules}:{}),
          fundingFlowVersion: 1, payoutHandler: 'clothme', fundingSource: 'brand',
          fundingTerms: form.affiliateType === "fixed_amount_per_install"
            ? "Opening the install link only attributes the new user. Earnings are estimates until a selected conversion is reviewed. This campaign does not collect a prepaid install pool."
            : "Commission is funded by qualifying sales; an enabled base is prepaid per creator slot.",
        },
      },
      ...(notes ? { notes } : {}),
    };
  }
  if (input.model === "hybrid") {
    const hybrid = completeHybridPayment(input.hybrid ?? defaultHybridPaymentForm());
    return {
      model: "hybrid",
      flatRateCents: hybrid.base?.enabled ? hybrid.base.amountCents ?? 0 : 0,
      milestoneStructure: hybrid.milestones?.payoutMethod,
      milestones: hybrid.milestones?.tiers,
      royaltyPercent: hybrid.affiliate?.enabled ? hybrid.affiliate.commissionPercent ?? 0 : 0,
      hybrid,
      ...(notes ? { notes } : {}),
    };
  }
  return {
    model: input.model,
    flatRateCents: parseMoneyToCents(input.flatAmount),
    ...(notes ? { notes } : {}),
  };
}
