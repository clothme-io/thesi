"use client";

import { useEffect, useState } from "react";
import type { Brand, Job } from "@/lib/creator-crm/types";

export interface AddTaskDrawerProps {
  open: boolean;
  onClose: () => void;
  brands: Brand[];
  jobs: Job[];
  onSubmit: (input: {
    title: string;
    body?: string;
    brandId?: string;
    jobId?: string;
    dueDate?: string;
  }) => Promise<void>;
}

export function AddTaskDrawer({
  open,
  onClose,
  brands,
  jobs,
  onSubmit,
}: AddTaskDrawerProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [brandId, setBrandId] = useState("");
  const [jobId, setJobId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const brandJobs = brandId
    ? jobs.filter((job) => job.brandId === brandId)
    : jobs;

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setBody("");
    setBrandId("");
    setJobId("");
    setDueDate("");
    setFeedback(null);
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

  const canSave = Boolean(title.trim());

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setFeedback(null);
    try {
      await onSubmit({
        title: title.trim(),
        ...(body.trim() ? { body: body.trim() } : {}),
        ...(brandId ? { brandId } : {}),
        ...(jobId ? { jobId } : {}),
        ...(dueDate ? { dueDate } : {}),
      });
      onClose();
    } catch (requestError) {
      setFeedback(
        requestError instanceof Error
          ? requestError.message
          : "Could not create task",
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
        aria-label="Add task"
      >
        <div className="crm-drawer-header">
          <div>
            <h2>Add task</h2>
            <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
              Track a follow-up tied to a brand or job
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
            <span>Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Send invoice to client"
            />
          </label>
          <label className="crm-form-field">
            <span>Details</span>
            <textarea
              rows={3}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Optional notes for this task"
            />
          </label>
          <label className="crm-form-field">
            <span>Brand (optional)</span>
            <select
              value={brandId}
              onChange={(e) => {
                setBrandId(e.target.value);
                setJobId("");
              }}
            >
              <option value="">None</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
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
            <span>Due date</span>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </label>
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
            disabled={!canSave || saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving…" : "Create task"}
          </button>
        </div>
      </aside>
    </>
  );
}
