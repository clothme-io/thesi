"use client";

import { useBrandBilling } from "@/lib/settings/brand-billing-storage";
import { BrandSettingsSection } from "./BrandSettingsSection";

export function BrandSettingsPaymentMethodsContent() {
  const { data, ready, setDefaultPaymentMethod } = useBrandBilling();

  if (!ready) return null;

  return (
    <BrandSettingsSection title="Payment methods" subtitle="Cards on file for subscriptions and payouts">
      <section className="workspace-section">
        <div className="brand-payment-methods">
          {data.paymentMethods.map((method) => (
            <div key={method.id} className="brand-payment-method-card">
              <div>
                <strong>
                  {method.label} ···· {method.last4}
                </strong>
                <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
                  Expires {String(method.expMonth).padStart(2, "0")}/{method.expYear}
                </p>
              </div>
              <div className="brand-payment-method-actions">
                {method.isDefault ? (
                  <span className="crm-tag">Default</span>
                ) : (
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    onClick={() => setDefaultPaymentMethod(method.id)}
                  >
                    Set default
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="crm-btn-secondary" style={{ marginTop: 16 }} disabled>
          + Add payment method
        </button>
        <p className="workspace-hint" style={{ marginTop: 8 }}>
          Payment method management will connect to Stripe in production.
        </p>
      </section>
    </BrandSettingsSection>
  );
}
