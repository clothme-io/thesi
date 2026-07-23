"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import {
  formatMoney,
  PAYMENT_STATUS_LABELS,
  type PaymentStatus,
} from "@/lib/creator-crm/types";
import { useSavedViews } from "@/lib/creator-crm/saved-views";

export function PaymentsPageContent() {
  const { session, authenticatedRequest } = useAuth();
  const { data, ready } = useCreatorCrm(authenticatedRequest);
  const [brandId, setBrandId] = useState("");
  const [status, setStatus] = useState("");
  const [viewName, setViewName] = useState("");
  const { views, saveView, deleteView } = useSavedViews(
    "payments",
    session?.user.id,
  );

  const filtered = useMemo(() => {
    return data.payments.filter((payment) => {
      if (brandId && payment.brandId !== brandId) return false;
      if (status && payment.status !== status) return false;
      return true;
    });
  }, [data.payments, brandId, status]);

  if (!ready) return null;

  const unpaid = filtered.filter((p) => p.status === "unpaid");
  const invoiceSent = filtered.filter((p) => p.status === "invoice_sent");
  const paid = filtered.filter((p) => p.status === "paid");
  const overdue = filtered.filter((p) => p.status === "overdue");
  const monthlyRevenue = paid.reduce((sum, p) => sum + p.amountCents, 0);

  return (
    <>
      <header className="app-topbar">
        <h1>Payments</h1>
        <Link href={CRM_ROUTES.invoices} className="crm-btn-primary">
          Open invoices
        </Link>
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
                placeholder="Overdue only"
              />
              <button
                type="button"
                className="crm-btn-secondary"
                onClick={() => {
                  saveView(viewName, { brandId, status });
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
            <strong>{formatMoney(monthlyRevenue)}</strong>
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
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="workspace-hint" style={{ margin: 0 }}>
                      No payments match these filters. Create one from{" "}
                      <Link href={CRM_ROUTES.invoices} className="auth-link">
                        Invoices
                      </Link>
                      .
                    </p>
                  </td>
                </tr>
              ) : (
                filtered.map((payment) => {
                  const brand = data.brands.find(
                    (b) => b.id === payment.brandId,
                  );
                  return (
                    <tr key={payment.id}>
                      <td>{payment.invoiceNumber || "—"}</td>
                      <td>
                        <Link href={CRM_ROUTES.brand(payment.brandId)}>
                          {brand?.name}
                        </Link>
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
                      <td>{payment.dueDate}</td>
                      <td
                        className={
                          payment.status === "overdue"
                            ? "crm-money--overdue"
                            : "crm-money"
                        }
                      >
                        {formatMoney(payment.amountCents)}
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
