"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useBrandBilling } from "@/lib/settings/brand-billing-storage";
import { formatBillingMoney } from "@/lib/settings/brand-billing-types";
import { BrandSettingsSection } from "./BrandSettingsSection";

export function BrandSettingsPaymentHistoryContent() {
  const { authenticatedRequest, authenticatedBinaryRequest } = useAuth();
  const { data, ready, error } = useBrandBilling(authenticatedRequest);
  const [actionError, setActionError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  if (!ready) return null;

  const downloadInvoice = async (invoiceId: string, invoiceNumber: string) => {
    setActionError("");
    setDownloadingId(invoiceId);
    try {
      const { blob, fileName } = await authenticatedBinaryRequest(
        `/api/billing/invoices/${invoiceId}/pdf`,
      );
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = fileName || `${invoiceNumber}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not download invoice",
      );
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <BrandSettingsSection title="Payment history" subtitle="Available Stripe invoices">
      <section className="workspace-section">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}
        {data.paymentHistory.length === 0 ? (
          <p className="workspace-hint">
            No Stripe invoices on this account. Campaign deposits appear on each campaign.
          </p>
        ) : (
          <div className="brand-ugc-table-wrap">
            <table className="brand-table brand-ugc-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Invoice</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.paymentHistory.map((entry) => (
                  <tr key={entry.id}>
                    <td>{entry.date}</td>
                    <td>{entry.description}</td>
                    <td>{entry.invoiceNumber}</td>
                    <td>{formatBillingMoney(entry.amountCents)}</td>
                    <td>
                      <span
                        className={`crm-status crm-status--${entry.status === "paid" ? "client" : entry.status === "pending" ? "active" : "lead"}`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="inbox-btn-text"
                        disabled={downloadingId === entry.id}
                        onClick={() => downloadInvoice(entry.id, entry.invoiceNumber)}
                      >
                        {downloadingId === entry.id ? "Downloading…" : "Download"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </BrandSettingsSection>
  );
}
