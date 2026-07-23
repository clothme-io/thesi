"use client";

import { useEffect, useState } from "react";
import { parseBrandsCsv, parseDealsCsv } from "@/lib/creator-crm/csv";

export function CsvImportDrawer({
  open,
  onClose,
  onImport,
}: {
  open: boolean;
  onClose: () => void;
  onImport: (payload: {
    brands?: ReturnType<typeof parseBrandsCsv>;
    deals?: ReturnType<typeof parseDealsCsv>;
  }) => Promise<void>;
}) {
  const [mode, setMode] = useState<"brands" | "deals">("brands");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFeedback(null);
    setSaving(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div className="crm-drawer-backdrop" onClick={onClose} aria-hidden="true" />
      <aside
        className="crm-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Import CSV"
      >
        <div className="crm-drawer-header">
          <div>
            <h2>Import CSV</h2>
            <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
              Import brands or deals into your creator CRM
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
          <label className="crm-form-field">
            <span>Import type</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "brands" | "deals")}
            >
              <option value="brands">Brands</option>
              <option value="deals">Deals</option>
            </select>
          </label>
          <p className="workspace-hint">
            {mode === "brands"
              ? "Headers: name, contactName, email, phone, website, relationshipStage, tags, notes"
              : "Headers: brandName, title, valueCents, stage, expectedCloseDate, notes"}
          </p>
          <label className="crm-form-field">
            <span>CSV file</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setFeedback(null);
                void file.text().then(async (text) => {
                  setSaving(true);
                  try {
                    if (mode === "brands") {
                      const brands = parseBrandsCsv(text);
                      if (brands.length === 0) {
                        throw new Error("No brand rows found");
                      }
                      await onImport({ brands });
                      setFeedback(`Imported ${brands.length} brand row(s).`);
                    } else {
                      const deals = parseDealsCsv(text);
                      if (deals.length === 0) {
                        throw new Error("No deal rows found");
                      }
                      await onImport({ deals });
                      setFeedback(`Imported ${deals.length} deal row(s).`);
                    }
                  } catch (requestError) {
                    setFeedback(
                      requestError instanceof Error
                        ? requestError.message
                        : "Could not import CSV",
                    );
                  } finally {
                    setSaving(false);
                    e.target.value = "";
                  }
                });
              }}
            />
          </label>
          {saving ? <p className="workspace-hint">Importing…</p> : null}
          {feedback ? (
            <p className="workspace-hint" style={{ color: "var(--ink)" }}>
              {feedback}
            </p>
          ) : null}
        </div>

        <div className="crm-drawer-footer">
          <button type="button" className="crm-btn-secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </>
  );
}
