"use client";

import { useMemo, useState } from "react";
import type { CustomField } from "@/lib/creator-crm/types";

export function CustomFieldsEditor({
  fields,
  values,
  onSave,
}: {
  fields: CustomField[];
  values: Record<string, string | number | boolean | null>;
  onSave: (
    next: Record<string, string | number | boolean | null>,
  ) => Promise<void>;
}) {
  const sorted = useMemo(
    () => [...fields].sort((a, b) => a.position - b.position),
    [fields],
  );
  const [draft, setDraft] = useState(values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  if (sorted.length === 0) return null;

  return (
    <section className="crm-list-card" style={{ marginTop: 16 }}>
      <h3>Custom fields</h3>
      <div className="crm-filters" style={{ marginTop: 12 }}>
        {sorted.map((field) => (
          <label key={field.id} className="crm-form-field">
            <span>
              {field.name}
              {field.required ? " *" : ""}
            </span>
            {field.fieldType === "boolean" ? (
              <select
                value={
                  draft[field.apiName] === true
                    ? "true"
                    : draft[field.apiName] === false
                      ? "false"
                      : ""
                }
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    [field.apiName]:
                      e.target.value === ""
                        ? null
                        : e.target.value === "true",
                  }))
                }
              >
                <option value="">—</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            ) : field.fieldType === "select" ? (
              <select
                value={String(draft[field.apiName] ?? "")}
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    [field.apiName]: e.target.value || null,
                  }))
                }
              >
                <option value="">—</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={
                  field.fieldType === "number"
                    ? "number"
                    : field.fieldType === "date"
                      ? "date"
                      : "text"
                }
                value={
                  draft[field.apiName] === null ||
                  draft[field.apiName] === undefined
                    ? ""
                    : String(draft[field.apiName])
                }
                onChange={(e) =>
                  setDraft((current) => ({
                    ...current,
                    [field.apiName]:
                      e.target.value === ""
                        ? null
                        : field.fieldType === "number"
                          ? Number(e.target.value)
                          : e.target.value,
                  }))
                }
              />
            )}
          </label>
        ))}
      </div>
      {error ? <p className="workspace-hint">{error}</p> : null}
      <button
        type="button"
        className="crm-btn-secondary"
        disabled={saving}
        onClick={() => {
          setSaving(true);
          setError("");
          void onSave(draft)
            .catch((requestError: unknown) => {
              setError(
                requestError instanceof Error
                  ? requestError.message
                  : "Could not save fields",
              );
            })
            .finally(() => setSaving(false));
        }}
      >
        {saving ? "Saving…" : "Save custom fields"}
      </button>
    </section>
  );
}
