"use client";

import {
  emptyMilestoneRow,
  MAX_MILESTONES,
  type MilestoneFormRow,
} from "@/lib/brand-campaigns/payment-form";

type Props = {
  rows: MilestoneFormRow[];
  onChange: (rows: MilestoneFormRow[]) => void;
};

export function MilestoneBuilder({ rows, onChange }: Props) {
  const updateRow = (index: number, patch: Partial<MilestoneFormRow>) => {
    onChange(rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  return (
    <div className="workspace-field workspace-field--full">
      <span>Milestones</span>
      <p className="workspace-hint" style={{ margin: 0 }}>
        Each row is a payout. Trigger is what must happen before that amount is due.
      </p>
      <div className="milestone-builder">
        {rows.map((row, index) => (
          <div className="milestone-row" key={row.id}>
            <label className="workspace-field">
              <span>Label</span>
              <input
                type="text"
                placeholder="Kickoff"
                value={row.label}
                onChange={(e) => updateRow(index, { label: e.target.value })}
              />
            </label>
            <label className="workspace-field">
              <span>Trigger</span>
              <input
                type="text"
                placeholder="Contract signed"
                value={row.trigger}
                onChange={(e) => updateRow(index, { trigger: e.target.value })}
              />
            </label>
            <label className="workspace-field">
              <span>Amount</span>
              <input
                type="text"
                inputMode="decimal"
                placeholder="$0.00"
                value={row.amount}
                onChange={(e) => updateRow(index, { amount: e.target.value })}
              />
            </label>
            <button
              type="button"
              className="inbox-btn-text milestone-row-remove"
              disabled={rows.length <= 1}
              onClick={() => onChange(rows.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      {rows.length < MAX_MILESTONES ? (
        <button
          type="button"
          className="inbox-btn-text"
          style={{ marginTop: 4 }}
          onClick={() => onChange([...rows, emptyMilestoneRow()])}
        >
          + Add milestone
        </button>
      ) : null}
    </div>
  );
}
