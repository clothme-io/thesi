import type {
  BrandCampaign,
  BrandCampaignMilestone,
  BrandCampaignPaymentModel,
} from "./types";

export const MAX_MILESTONES = 5;

export type MilestoneFormRow = {
  id: string;
  label: string;
  trigger: string;
  amount: string;
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
  return Number.isInteger(dollars) ? String(dollars) : dollars.toFixed(2);
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

export function validateMilestoneRows(rows: MilestoneFormRow[]): string | null {
  if (completeMilestoneRows(rows).length === 0) {
    return "Add at least one milestone with a label, trigger, and amount.";
  }
  return null;
}

export function paymentFormError(
  model: BrandCampaignPaymentModel,
  milestones: MilestoneFormRow[],
): string | null {
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
): number {
  if (model === "milestone") {
    return completeMilestoneRows(milestones).reduce(
      (sum, milestone) => sum + milestone.amountCents,
      0,
    );
  }
  return parseMoneyToCents(flatAmount);
}

export function buildCampaignPayment(input: {
  model: BrandCampaignPaymentModel;
  flatAmount: string;
  notes: string;
  milestones: MilestoneFormRow[];
}): BrandCampaign["payment"] {
  const notes = input.notes.trim() || undefined;
  if (input.model === "milestone") {
    return {
      model: "milestone",
      milestones: completeMilestoneRows(input.milestones),
      ...(notes ? { notes } : {}),
    };
  }
  return {
    model: input.model,
    flatRateCents: parseMoneyToCents(input.flatAmount),
    ...(notes ? { notes } : {}),
  };
}
