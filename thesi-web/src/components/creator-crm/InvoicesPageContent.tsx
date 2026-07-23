"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import {
  formatMoney,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from "@/lib/creator-crm/types";

function defaultDueDate() {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  return date.toISOString().slice(0, 10);
}

export function InvoicesPageContent() {
  const { authenticatedRequest, authenticatedBinaryRequest } = useAuth();
  const { data, ready, error, createInvoice, updateInvoice } =
    useCreatorCrm(authenticatedRequest);
  const [showForm, setShowForm] = useState(false);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [brandId, setBrandId] = useState("");
  const [jobId, setJobId] = useState("");
  const [amountDollars, setAmountDollars] = useState("");
  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [description, setDescription] = useState("");

  const jobsForBrand = useMemo(
    () => data.jobs.filter((job) => !brandId || job.brandId === brandId),
    [data.jobs, brandId],
  );

  if (!ready) return null;

  const unpaid = data.payments.filter((p) => p.status === "unpaid");
  const invoiceSent = data.payments.filter((p) => p.status === "invoice_sent");
  const paid = data.payments.filter((p) => p.status === "paid");
  const overdue = data.payments.filter((p) => p.status === "overdue");
  const totalPaid = paid.reduce((sum, p) => sum + p.amountCents, 0);

  const resetForm = () => {
    setBrandId("");
    setJobId("");
    setAmountDollars("");
    setDueDate(defaultDueDate());
    setDescription("");
    setShowForm(false);
  };

  const handleCreate = async (event: FormEvent) => {
    event.preventDefault();
    setActionError("");
    const amountCents = Math.round(Number(amountDollars) * 100);
    if (!brandId) {
      setActionError("Select a brand.");
      return;
    }
    if (!Number.isFinite(amountCents) || amountCents < 1) {
      setActionError("Enter a valid amount.");
      return;
    }
    setSaving(true);
    try {
      await createInvoice({
        brandId,
        ...(jobId ? { jobId } : {}),
        amountCents,
        dueDate,
        description: description.trim() || undefined,
      });
      resetForm();
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not create invoice",
      );
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (paymentId: string, status: PaymentStatus) => {
    setActionError("");
    try {
      await updateInvoice(paymentId, { status });
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update invoice",
      );
    }
  };

  const downloadPdf = async (paymentId: string, invoiceNumber?: string) => {
    setActionError("");
    try {
      const { blob, fileName } = await authenticatedBinaryRequest(
        `/api/creator-crm/payments/${paymentId}/pdf`,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName || `${invoiceNumber || "invoice"}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not download PDF",
      );
    }
  };

  return (
    <>
      <header className="app-topbar">
        <h1>Invoices</h1>
        <button
          type="button"
          className="crm-btn-primary"
          onClick={() => setShowForm(true)}
          disabled={data.brands.length === 0}
        >
          + New invoice
        </button>
      </header>

      <div className="app-content">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}

        {data.brands.length === 0 ? (
          <p className="workspace-hint" style={{ marginBottom: 16 }}>
            Add a brand in{" "}
            <Link href={CRM_ROUTES.brands} className="auth-link">
              CRM → Brands
            </Link>{" "}
            (or apply to a marketplace listing) before creating invoices.
          </p>
        ) : null}

        <p className="crm-invoice-hint">
          <strong>Mark as sent</strong> only tracks that you sent an invoice. It
          does not email the brand. Download the PDF and send it yourself.
        </p>

        <div className="crm-dashboard-grid" style={{ marginBottom: 24 }}>
          <div className="app-stat-card">
            <span>Unpaid</span>
            <strong>{unpaid.length}</strong>
          </div>
          <div className="app-stat-card">
            <span>Invoice sent</span>
            <strong>{invoiceSent.length}</strong>
          </div>
          <div className="app-stat-card">
            <span>Paid</span>
            <strong className="crm-money--paid">{paid.length}</strong>
          </div>
          <div className="app-stat-card">
            <span>Overdue</span>
            <strong className="crm-money--overdue">{overdue.length}</strong>
          </div>
          <div className="app-stat-card">
            <span>Total paid</span>
            <strong>{formatMoney(totalPaid)}</strong>
          </div>
        </div>

        <div className="crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Brand</th>
                <th>Status</th>
                <th>Due</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <p className="workspace-hint" style={{ margin: 0 }}>
                      No invoices yet.
                    </p>
                  </td>
                </tr>
              ) : (
                data.payments.map((payment) => {
                  const brand = data.brands.find((b) => b.id === payment.brandId);
                  return (
                    <tr key={payment.id}>
                      <td>
                        <div>{payment.invoiceNumber || "—"}</div>
                        {payment.description ? (
                          <div className="workspace-hint">{payment.description}</div>
                        ) : null}
                      </td>
                      <td>
                        {brand ? (
                          <Link href={CRM_ROUTES.brand(payment.brandId)}>
                            {brand.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        <span
                          className={`crm-status crm-status--${
                            payment.status === "paid"
                              ? "client"
                              : payment.status === "overdue"
                                ? "lead"
                                : "active"
                          }`}
                        >
                          {PAYMENT_STATUS_LABELS[payment.status]}
                        </span>
                      </td>
                      <td>{payment.dueDate || "—"}</td>
                      <td
                        className={
                          payment.status === "overdue"
                            ? "crm-money--overdue"
                            : "crm-money"
                        }
                      >
                        {formatMoney(payment.amountCents)}
                      </td>
                      <td>
                        <div className="brand-payment-method-actions">
                          <button
                            type="button"
                            className="crm-btn-secondary"
                            onClick={() =>
                              downloadPdf(payment.id, payment.invoiceNumber)
                            }
                          >
                            PDF
                          </button>
                          {payment.status === "unpaid" ? (
                            <button
                              type="button"
                              className="crm-btn-secondary"
                              title="Tracks status only — does not email the brand"
                              onClick={() =>
                                setStatus(payment.id, "invoice_sent")
                              }
                            >
                              Mark as sent
                            </button>
                          ) : null}
                          {payment.status === "invoice_sent" && payment.sentAt ? (
                            <span className="workspace-hint">
                              Marked sent{" "}
                              {new Date(payment.sentAt).toLocaleDateString()}
                            </span>
                          ) : null}
                          {payment.status !== "paid" ? (
                            <button
                              type="button"
                              className="crm-btn-secondary"
                              onClick={() => setStatus(payment.id, "paid")}
                            >
                              Mark paid
                            </button>
                          ) : null}
                          {payment.status === "unpaid" ||
                          payment.status === "invoice_sent" ? (
                            <button
                              type="button"
                              className="crm-btn-secondary"
                              onClick={() => setStatus(payment.id, "overdue")}
                            >
                              Overdue
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <p className="crm-contact-sub" style={{ marginTop: 16 }}>
          Also visible under{" "}
          <Link href={CRM_ROUTES.payments} className="auth-link">
            CRM → Payments
          </Link>
          . Set up where you get paid in{" "}
          <Link href="/app/settings" className="auth-link">
            Settings → Payouts
          </Link>
          .
        </p>
      </div>

      {showForm ? (
        <div
          className="marketplace-modal-backdrop"
          onClick={resetForm}
          role="presentation"
        >
          <div
            className="marketplace-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="New invoice"
          >
            <h2>New invoice</h2>
            <p className="workspace-hint" style={{ marginBottom: 16 }}>
              Creates a CRM payment record. Leave job blank to auto-create one
              for the brand.
            </p>
            <form onSubmit={handleCreate} className="workspace-form">
              <label className="workspace-field">
                <span>Brand</span>
                <select
                  value={brandId}
                  onChange={(event) => {
                    setBrandId(event.target.value);
                    setJobId("");
                  }}
                  required
                >
                  <option value="">Select brand</option>
                  {data.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-field">
                <span>Job (optional)</span>
                <select
                  value={jobId}
                  onChange={(event) => setJobId(event.target.value)}
                  disabled={!brandId}
                >
                  <option value="">Create new job</option>
                  {jobsForBrand.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.title} — {formatMoney(job.amountCents)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-field">
                <span>Amount (USD)</span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amountDollars}
                  onChange={(event) => setAmountDollars(event.target.value)}
                  required
                />
              </label>
              <label className="workspace-field">
                <span>Due date</span>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  required
                />
              </label>
              <label className="workspace-field">
                <span>Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="UGC package — July"
                />
              </label>
              {actionError ? (
                <p className="workspace-hint">{actionError}</p>
              ) : null}
              <div className="marketplace-modal-footer">
                <button
                  type="button"
                  className="crm-btn-secondary"
                  onClick={resetForm}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="crm-btn-primary"
                  disabled={saving}
                >
                  {saving ? "Creating…" : "Create invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
