"use client";

import { useBrandBilling } from "@/lib/settings/brand-billing-storage";
import { formatBillingMoney } from "@/lib/settings/brand-billing-types";
import { BrandSettingsSection } from "./BrandSettingsSection";

export function BrandSettingsPaymentHistoryContent() {
  const { data, ready } = useBrandBilling();

  if (!ready) return null;

  return (
    <BrandSettingsSection title="Payment history" subtitle="Invoices and past charges">
      <section className="workspace-section">
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
                    <span className={`crm-status crm-status--${entry.status === "paid" ? "client" : entry.status === "pending" ? "active" : "lead"}`}>
                      {entry.status}
                    </span>
                  </td>
                  <td>
                    <button type="button" className="inbox-btn-text" disabled>
                      Download
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </BrandSettingsSection>
  );
}
