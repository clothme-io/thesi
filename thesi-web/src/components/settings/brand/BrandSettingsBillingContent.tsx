"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useBrandBilling } from "@/lib/settings/brand-billing-storage";
import { formatBillingMoney } from "@/lib/settings/brand-billing-types";
import { BrandSettingsSection } from "./BrandSettingsSection";

export function BrandSettingsBillingContent() {
  const { authenticatedRequest } = useAuth();
  const { data, ready, saved, error, updateBilling, persistBilling } =
    useBrandBilling(authenticatedRequest);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!ready) return null;

  const { billing } = data;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setActionError("");
    try {
      await persistBilling(billing);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save billing",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <BrandSettingsSection title="Billing" subtitle="Plan and billing details" saved={saved}>
      <form className="workspace-form" onSubmit={handleSave}>
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}
        <section className="workspace-section">
          <h3>Current plan</h3>
          <div className="brand-billing-plan">
            <div>
              <strong>{billing.planName}</strong>
              <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
                {formatBillingMoney(billing.planPriceCents)} / {billing.billingCycle}
              </p>
            </div>
            <span className="crm-tag">Active</span>
          </div>
          <div className="crm-meta-row" style={{ marginTop: 16 }}>
            <span>Next invoice</span>
            <span>{billing.nextInvoiceDate || "—"}</span>
          </div>
        </section>

        <section className="workspace-section">
          <h3>Billing contact</h3>
          <div className="workspace-grid">
            <label className="workspace-field">
              <span>Billing email</span>
              <input
                type="email"
                value={billing.billingEmail}
                onChange={(e) => updateBilling({ billingEmail: e.target.value })}
              />
            </label>
            <label className="workspace-field">
              <span>Company name</span>
              <input
                type="text"
                value={billing.companyName}
                onChange={(e) => updateBilling({ companyName: e.target.value })}
              />
            </label>
            <label className="workspace-field">
              <span>Tax ID (optional)</span>
              <input
                type="text"
                value={billing.taxId ?? ""}
                onChange={(e) => updateBilling({ taxId: e.target.value })}
              />
            </label>
          </div>
        </section>

        <section className="workspace-section">
          <h3>Billing address</h3>
          <div className="workspace-grid">
            <label className="workspace-field workspace-field--full">
              <span>Address line 1</span>
              <input
                type="text"
                value={billing.addressLine1}
                onChange={(e) => updateBilling({ addressLine1: e.target.value })}
              />
            </label>
            <label className="workspace-field workspace-field--full">
              <span>Address line 2</span>
              <input
                type="text"
                value={billing.addressLine2 ?? ""}
                onChange={(e) => updateBilling({ addressLine2: e.target.value })}
              />
            </label>
            <label className="workspace-field">
              <span>City</span>
              <input type="text" value={billing.city} onChange={(e) => updateBilling({ city: e.target.value })} />
            </label>
            <label className="workspace-field">
              <span>State / region</span>
              <input type="text" value={billing.state} onChange={(e) => updateBilling({ state: e.target.value })} />
            </label>
            <label className="workspace-field">
              <span>Postal code</span>
              <input
                type="text"
                value={billing.postalCode}
                onChange={(e) => updateBilling({ postalCode: e.target.value })}
              />
            </label>
            <label className="workspace-field">
              <span>Country</span>
              <input
                type="text"
                value={billing.country}
                onChange={(e) => updateBilling({ country: e.target.value })}
              />
            </label>
          </div>
        </section>

        <div className="workspace-form-footer">
          <button type="submit" className="crm-btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save billing"}
          </button>
        </div>
      </form>
    </BrandSettingsSection>
  );
}
