"use client";

import { useEffect, useState } from "react";
import type { Brand, CalendarEventType, Job } from "@/lib/creator-crm/types";

const TYPE_OPTIONS: { value: CalendarEventType; label: string }[] = [
  { value: "shoot", label: "Shoot" },
  { value: "draft_due", label: "Draft due" },
  { value: "submission", label: "Submission" },
  { value: "posting", label: "Posting" },
  { value: "campaign_launch", label: "Campaign launch" },
  { value: "payment_due", label: "Payment due" },
];

export interface AddCalendarEventDrawerProps {
  open: boolean;
  onClose: () => void;
  brands: Brand[];
  jobs: Job[];
  onSubmit: (input: {
    title: string;
    type: CalendarEventType;
    date: string;
    brandId?: string;
    jobId?: string;
    notes?: string;
  }) => Promise<void>;
}

export function AddCalendarEventDrawer({
  open,
  onClose,
  brands,
  jobs,
  onSubmit,
}: AddCalendarEventDrawerProps) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<CalendarEventType>("shoot");
  const [date, setDate] = useState("");
  const [brandId, setBrandId] = useState("");
  const [jobId, setJobId] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const brandJobs = brandId
    ? jobs.filter((job) => job.brandId === brandId)
    : jobs;

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setType("shoot");
    setDate(new Date().toISOString().slice(0, 10));
    setBrandId("");
    setJobId("");
    setNotes("");
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

  const canSave = Boolean(title.trim() && date);

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    setFeedback(null);
    try {
      await onSubmit({
        title: title.trim(),
        type,
        date,
        ...(brandId ? { brandId } : {}),
        ...(jobId ? { jobId } : {}),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      onClose();
    } catch (requestError) {
      setFeedback(
        requestError instanceof Error
          ? requestError.message
          : "Could not create event",
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
        aria-label="Add calendar event"
      >
        <div className="crm-drawer-header">
          <div>
            <h2>Add event</h2>
            <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
              Schedule content or delivery milestones
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
              placeholder="Product shoot"
            />
          </label>
          <label className="crm-form-field">
            <span>Type</span>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CalendarEventType)}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-form-field">
            <span>Date</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
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
            <span>Notes</span>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
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
            {saving ? "Saving…" : "Create event"}
          </button>
        </div>
      </aside>
    </>
  );
}
