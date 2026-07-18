"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import { formatMoney, PAYMENT_STATUS_LABELS } from "@/lib/creator-crm/types";

export function PaymentsPageContent() {
  const { authenticatedRequest } = useAuth();
  const { data, ready } = useCreatorCrm(authenticatedRequest);
  if (!ready) return null;

  const unpaid = data.payments.filter((p) => p.status === "unpaid");
  const invoiceSent = data.payments.filter((p) => p.status === "invoice_sent");
  const paid = data.payments.filter((p) => p.status === "paid");
  const overdue = data.payments.filter((p) => p.status === "overdue");
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
              {data.payments.length === 0 ? (
                <tr>
                  <td colSpan={5}>
                    <p className="workspace-hint" style={{ margin: 0 }}>
                      No payments yet. Create one from{" "}
                      <Link href={CRM_ROUTES.invoices} className="auth-link">
                        Invoices
                      </Link>
                      .
                    </p>
                  </td>
                </tr>
              ) : (
                data.payments.map((payment) => {
                  const brand = data.brands.find((b) => b.id === payment.brandId);
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
