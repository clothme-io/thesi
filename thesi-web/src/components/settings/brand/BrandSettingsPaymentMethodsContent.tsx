"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useBrandBilling } from "@/lib/settings/brand-billing-storage";
import { getStripePublishableKey } from "@/lib/stripe/publishable-key";
import { BrandSettingsSection } from "./BrandSettingsSection";
import { AddPaymentMethodModal } from "./AddPaymentMethodModal";

export function BrandSettingsPaymentMethodsContent() {
  const { authenticatedRequest } = useAuth();
  const {
    data,
    ready,
    error,
    setDefaultPaymentMethod,
    createSetupIntent,
    refreshBilling,
  } = useBrandBilling(authenticatedRequest);
  const [actionError, setActionError] = useState("");
  const [opening, setOpening] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  if (!ready) return null;

  const publishableKey = getStripePublishableKey();

  const handleAdd = async () => {
    setActionError("");
    if (!publishableKey) {
      setActionError(
        "Set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in thesi-web to add cards.",
      );
      return;
    }

    setOpening(true);
    try {
      const intent = await createSetupIntent();
      if (!intent.stripeConfigured || !intent.clientSecret) {
        setActionError(
          "Stripe is not configured on the API (STRIPE_SECRET_KEY). Cards cannot be captured yet.",
        );
        return;
      }
      setClientSecret(intent.clientSecret);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not start card setup",
      );
    } finally {
      setOpening(false);
    }
  };

  return (
    <BrandSettingsSection
      title="Payment methods"
      subtitle="Cards on file for subscriptions and invoices"
    >
      <section className="workspace-section">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}
        {data.paymentMethods.length === 0 ? (
          <p className="workspace-hint">No payment methods on file yet.</p>
        ) : (
          <div className="brand-payment-methods">
            {data.paymentMethods.map((method) => (
              <div key={method.id} className="brand-payment-method-card">
                <div>
                  <strong>
                    {method.label} ···· {method.last4}
                  </strong>
                  <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
                    Expires {String(method.expMonth).padStart(2, "0")}/
                    {method.expYear}
                  </p>
                </div>
                <div className="brand-payment-method-actions">
                  {method.isDefault ? (
                    <span className="crm-tag">Default</span>
                  ) : (
                    <button
                      type="button"
                      className="crm-btn-secondary"
                      onClick={async () => {
                        setActionError("");
                        try {
                          await setDefaultPaymentMethod(method.id);
                        } catch (requestError) {
                          setActionError(
                            requestError instanceof Error
                              ? requestError.message
                              : "Could not update default payment method",
                          );
                        }
                      }}
                    >
                      Set default
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        <button
          type="button"
          className="crm-btn-secondary"
          style={{ marginTop: 16 }}
          onClick={handleAdd}
          disabled={opening}
        >
          {opening ? "Preparing…" : "+ Add payment method"}
        </button>
        <p className="workspace-hint" style={{ marginTop: 8 }}>
          Cards are captured with Stripe Elements (SetupIntent). Requires
          STRIPE_SECRET_KEY on the API and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY on
          the web app.
        </p>
      </section>

      {clientSecret ? (
        <AddPaymentMethodModal
          clientSecret={clientSecret}
          onClose={() => setClientSecret(null)}
          onSuccess={async () => {
            await refreshBilling();
          }}
        />
      ) : null}
    </BrandSettingsSection>
  );
}
