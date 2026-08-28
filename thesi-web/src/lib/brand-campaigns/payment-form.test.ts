import { describe, expect, it } from "vitest";
import {
  buildCampaignPayment,
  completeMilestoneRows,
  formPayoutCents,
  milestonesToFormRows,
  paymentFormError,
  seedMilestonesIfNeeded,
  validateMilestoneRows,
  type MilestoneFormRow,
} from "./payment-form";

function row(
  overrides: Partial<MilestoneFormRow> = {},
): MilestoneFormRow {
  return {
    id: "m1",
    label: "Kickoff",
    trigger: "Contract signed",
    amount: "150",
    ...overrides,
  };
}

describe("milestone payment form", () => {
  it("keeps a comma-free dollar amount as cents", () => {
    expect(
      completeMilestoneRows([row({ amount: "$150.50" })]),
    ).toEqual([
      {
        id: "m1",
        label: "Kickoff",
        trigger: "Contract signed",
        amountCents: 15050,
      },
    ]);
  });

  it("drops incomplete rows and requires one complete milestone", () => {
    expect(
      completeMilestoneRows([
        row({ label: "", amount: "" }),
        row({ id: "m2", label: "Final", trigger: "Approved", amount: "300" }),
      ]),
    ).toHaveLength(1);
    expect(validateMilestoneRows([row({ amount: "" })])).toMatch(/at least one/i);
    expect(validateMilestoneRows([row()])).toBeNull();
  });

  it("builds milestone payment without a flat amount", () => {
    expect(
      buildCampaignPayment({
        model: "milestone",
        flatAmount: "999",
        notes: "Net 15",
        milestones: [row(), row({ id: "m2", label: "Final", trigger: "Done", amount: "250" })],
      }),
    ).toEqual({
      model: "milestone",
      notes: "Net 15",
      milestones: [
        {
          id: "m1",
          label: "Kickoff",
          trigger: "Contract signed",
          amountCents: 15000,
        },
        {
          id: "m2",
          label: "Final",
          trigger: "Done",
          amountCents: 25000,
        },
      ],
    });
  });

  it("omits milestones for flat rate", () => {
    expect(
      buildCampaignPayment({
        model: "flat_rate",
        flatAmount: "450",
        notes: "",
        milestones: [row()],
      }),
    ).toEqual({
      model: "flat_rate",
      flatRateCents: 45000,
    });
  });

  it("sums complete milestone amounts for the fee preview", () => {
    expect(formPayoutCents("milestone", "999", [row(), row({ amount: "50" })])).toBe(
      20000,
    );
    expect(formPayoutCents("flat_rate", "450", [row()])).toBe(45000);
  });

  it("hydrates saved milestones and seeds blanks when switching to milestone", () => {
    const hydrated = milestonesToFormRows([
      {
        id: "saved",
        label: "Concept",
        trigger: "Approved",
        amountCents: 75000,
      },
    ]);
    expect(hydrated).toEqual([
      {
        id: "saved",
        label: "Concept",
        trigger: "Approved",
        amount: "750",
      },
    ]);
    const seeded = seedMilestonesIfNeeded("milestone", []);
    expect(seeded).toHaveLength(3);
    expect(seeded[0]?.label).toBe("Kickoff");
  });

  it("only validates milestones when the payment model is milestone", () => {
    expect(paymentFormError("flat_rate", [])).toBeNull();
    expect(paymentFormError("milestone", [row({ amount: "" })])).toMatch(
      /at least one/i,
    );
  });
});
