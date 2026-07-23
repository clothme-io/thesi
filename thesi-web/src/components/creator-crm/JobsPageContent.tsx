"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import {
  formatMoney,
  JOB_STATUS_LABELS,
  PAYMENT_STATUS_LABELS,
  type JobStatus,
  type PaymentStatus,
} from "@/lib/creator-crm/types";
import { useSavedViews } from "@/lib/creator-crm/saved-views";

export function JobsPageContent() {
  const { session, authenticatedRequest } = useAuth();
  const { data, ready } = useCreatorCrm(authenticatedRequest);
  const [brandId, setBrandId] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [viewName, setViewName] = useState("");
  const { views, saveView, deleteView } = useSavedViews(
    "jobs",
    session?.user.id,
  );

  const filtered = useMemo(() => {
    return data.jobs.filter((job) => {
      if (brandId && job.brandId !== brandId) return false;
      if (status && job.status !== status) return false;
      if (paymentStatus && job.paymentStatus !== paymentStatus) return false;
      return true;
    });
  }, [data.jobs, brandId, status, paymentStatus]);

  if (!ready) return null;

  return (
    <>
      <header className="app-topbar">
        <h1>Jobs</h1>
        <span style={{ color: "var(--muted)", fontSize: 14 }}>
          Won deals become active jobs
        </span>
      </header>

      <div className="app-content">
        <div className="crm-filters">
          <label className="crm-form-field">
            <span>Brand</span>
            <select
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
            >
              <option value="">All brands</option>
              {data.brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-form-field">
            <span>Status</span>
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              {(Object.keys(JOB_STATUS_LABELS) as JobStatus[]).map((key) => (
                <option key={key} value={key}>
                  {JOB_STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-form-field">
            <span>Payment</span>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
            >
              <option value="">All payments</option>
              {(Object.keys(PAYMENT_STATUS_LABELS) as PaymentStatus[]).map(
                (key) => (
                  <option key={key} value={key}>
                    {PAYMENT_STATUS_LABELS[key]}
                  </option>
                ),
              )}
            </select>
          </label>
          <label className="crm-form-field">
            <span>Save view</span>
            <div className="crm-save-view-row">
              <input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Active unpaid"
              />
              <button
                type="button"
                className="crm-btn-secondary"
                onClick={() => {
                  saveView(viewName, { brandId, status, paymentStatus });
                  setViewName("");
                }}
              >
                Save
              </button>
            </div>
          </label>
        </div>

        {views.length > 0 ? (
          <div className="crm-saved-views">
            {views.map((view) => (
              <span key={view.id} className="crm-saved-view">
                <button
                  type="button"
                  className="crm-saved-view-apply"
                  onClick={() => {
                    setBrandId(view.filters.brandId || "");
                    setStatus(view.filters.status || "");
                    setPaymentStatus(view.filters.paymentStatus || "");
                  }}
                >
                  {view.name}
                </button>
                <button
                  type="button"
                  className="crm-saved-view-remove"
                  aria-label={`Remove ${view.name}`}
                  onClick={() => deleteView(view.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Job</th>
                <th>Brand</th>
                <th>Deadline</th>
                <th>Status</th>
                <th>Payment</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <p className="workspace-hint" style={{ margin: 0 }}>
                      No jobs match these filters.
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((job) => {
                  const brand = data.brands.find((b) => b.id === job.brandId);
                  return (
                    <tr key={job.id} className="crm-table-row-link">
                      <td>
                        <Link
                          href={CRM_ROUTES.job(job.id)}
                          className="crm-table-link"
                        >
                          <span className="crm-contact-name">{job.title}</span>
                          <span className="crm-contact-sub">
                            {job.deliverables}
                          </span>
                        </Link>
                      </td>
                      <td>
                        <Link href={CRM_ROUTES.brand(job.brandId)}>
                          {brand?.name}
                        </Link>
                      </td>
                      <td>{job.deadline}</td>
                      <td>{JOB_STATUS_LABELS[job.status]}</td>
                      <td>{PAYMENT_STATUS_LABELS[job.paymentStatus]}</td>
                      <td className="crm-money">
                        {formatMoney(job.amountCents)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
