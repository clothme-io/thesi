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
  affiliateType: BrandCampaignHybridAffiliateType;
  affiliatePercent: string;
  affiliateFixedAmount: string;
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
    affiliateEnabled: false,
    affiliateType: "percentage_of_sale",
    affiliatePercent: "",
    affiliateFixedAmount: "",
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
    baseEnabled: hybrid?.base?.enabled ?? true,
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
    affiliateEnabled: hybrid?.affiliate?.enabled ?? false,
    affiliateType: hybrid?.affiliate?.commissionType ?? defaults.affiliateType,
    affiliatePercent: affiliatePercent ? String(affiliatePercent) : "",
    affiliateFixedAmount: centsToInput(hybrid?.affiliate?.fixedAmountCents),
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
