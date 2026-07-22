"use client";

import { useEffect, useState } from "react";
import type { Brand, DealStage } from "@/lib/creator-crm/types";
import { DEAL_STAGES, DEAL_STAGE_LABELS } from "@/lib/creator-crm/types";

export interface AddDealDrawerProps {
  open: boolean;
  onClose: () => void;
  brands: Brand[];
  onSubmit: (input: {
    brandId: string;
    title: string;
    valueCents: number;
    stage: DealStage;
    expectedCloseDate?: string;
    notes?: string;
  }) => Promise<void>;
}

export function AddDealDrawer({
  open,
  onClose,
  brands,
  onSubmit,
}: AddDealDrawerProps) {
  const [brandId, setBrandId] = useState("");
  const [title, setTitle] = useState("");
  const [valueDollars, setValueDollars] = useState("");
  const [stage, setStage] = useState<DealStage>("lead");
  const [expectedCloseDate, setExpectedCloseDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBrandId(brands[0]?.id ?? "");
    setTitle("");
    setValueDollars("");
    setStage("lead");
    setExpectedCloseDate("");
    setNotes("");
    setFeedback(null);
  }, [open, brands]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const canSave = Boolean(brandId && title.trim());

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setFeedback(null);
    try {
      const dollars = Number.parseFloat(valueDollars || "0");
      await onSubmit({
        brandId,
        title: title.trim(),
        valueCents: Number.isFinite(dollars) ? Math.round(dollars * 100) : 0,
        stage,
        ...(expectedCloseDate ? { expectedCloseDate } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onClose();
    } catch (requestError) {
      setFeedback(
        requestError instanceof Error
          ? requestError.message
          : "Could not create deal",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="crm-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="crm-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Add deal"
      >
        <div className="crm-drawer-header">
          <div>
            <h2>Add deal</h2>
            <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
              Create a pipeline opportunity for a brand
            </p>
          </div>
          <button
            type="button"
            className="crm-drawer-close"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="crm-drawer-body">
          {brands.length === 0 ? (
            <p className="workspace-hint">
              Add a brand first (invite or marketplace), then create a deal.
            </p>
          ) : (
            <>
              <label className="crm-form-field">
                <span>Brand</span>
                <select value={brandId} onChange={(e) => setBrandId(e.target.value)}>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-form-field">
                <span>Title</span>
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Summer UGC package"
                />
              </label>
              <label className="crm-form-field">
                <span>Value (USD)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valueDollars}
                  onChange={(e) => setValueDollars(e.target.value)}
                  placeholder="500"
                />
              </label>
              <label className="crm-form-field">
                <span>Stage</span>
                <select
                  value={stage}
                  onChange={(e) => setStage(e.target.value as DealStage)}
                >
                  {DEAL_STAGES.map((item) => (
                    <option key={item} value={item}>
                      {DEAL_STAGE_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-form-field">
                <span>Expected close</span>
                <input
                  type="date"
                  value={expectedCloseDate}
                  onChange={(e) => setExpectedCloseDate(e.target.value)}
                />
              </label>
              <label className="crm-form-field">
                <span>Notes</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional context"
                />
              </label>
            </>
          )}
          {feedback && (
            <p className="workspace-hint" style={{ color: "var(--ink)" }}>
              {feedback}
            </p>
          )}
        </div>

        <div className="crm-drawer-footer">
          <button type="button" className="crm-btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="crm-btn-primary"
            disabled={!canSave || saving || brands.length === 0}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Create deal"}
          </button>
        </div>
      </aside>
    </>
  );
}
