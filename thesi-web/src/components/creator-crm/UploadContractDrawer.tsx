"use client";

import { useEffect, useState } from "react";
import type { Brand, ContractStatus, Job } from "@/lib/creator-crm/types";
import { CONTRACT_STATUSES, CONTRACT_STATUS_LABELS } from "@/lib/creator-crm/types";

export interface UploadContractDrawerProps {
  open: boolean;
  onClose: () => void;
  brands: Brand[];
  jobs: Job[];
  onSubmit: (input: {
    brandId: string;
    title: string;
    jobId?: string;
    status?: ContractStatus;
    expiresAt?: string;
    file?: File | null;
  }) => Promise<void>;
}

export function UploadContractDrawer({
  open,
  onClose,
  brands,
  jobs,
  onSubmit,
}: UploadContractDrawerProps) {
  const [brandId, setBrandId] = useState("");
  const [title, setTitle] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState<ContractStatus>("draft");
  const [expiresAt, setExpiresAt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const brandJobs = brandId
    ? jobs.filter((job) => job.brandId === brandId)
    : [];

  useEffect(() => {
    if (!open) return;
    setBrandId(brands[0]?.id ?? "");
    setTitle("");
    setJobId("");
    setStatus("draft");
    setExpiresAt("");
    setFile(null);
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
      await onSubmit({
        brandId,
        title: title.trim(),
        ...(jobId ? { jobId } : {}),
        status,
        ...(expiresAt ? { expiresAt } : {}),
        file,
      });
      onClose();
    } catch (requestError) {
      setFeedback(
        requestError instanceof Error
          ? requestError.message
          : "Could not upload contract",
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
        aria-label="Upload contract"
      >
        <div className="crm-drawer-header">
          <div>
            <h2>Upload contract</h2>
            <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
              Store contract metadata and an optional file
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
            <p className="workspace-hint">Add a brand before uploading a contract.</p>
          ) : (
            <>
              <label className="crm-form-field">
                <span>Brand</span>
                <select
                  value={brandId}
                  onChange={(e) => {
                    setBrandId(e.target.value);
                    setJobId("");
                  }}
                >
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
                  placeholder="UGC services agreement"
                />
              </label>
              <label className="crm-form-field">
                <span>Job (optional)</span>
                <select value={jobId} onChange={(e) => setJobId(e.target.value)}>
                  <option value="">None</option>
                  {brandJobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-form-field">
                <span>Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ContractStatus)}
                >
                  {CONTRACT_STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {CONTRACT_STATUS_LABELS[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="crm-form-field">
                <span>Expires</span>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                />
              </label>
              <label className="crm-form-field">
                <span>File (optional)</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.zip,.txt"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="workspace-hint">
                E-signature integration coming later. Max 25MB.
              </p>
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
            {saving ? "Saving…" : "Save contract"}
          </button>
        </div>
      </aside>
    </>
  );
}
