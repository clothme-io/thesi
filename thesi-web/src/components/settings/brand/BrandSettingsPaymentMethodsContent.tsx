"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useBrandBilling } from "@/lib/settings/brand-billing-storage";
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
  const [cardSetup, setCardSetup] = useState<{
    clientSecret: string;
    publishableKey: string;
  } | null>(null);

  if (!ready) return null;

  const handleAdd = async () => {
    setActionError("");
    setOpening(true);
    try {
      const intent = await createSetupIntent();
      if (!intent.stripeConfigured) {
        setActionError(
          "Stripe is not configured on the API (STRIPE_SECRET_KEY). Cards cannot be captured yet.",
        );
        return;
      }
      if (!intent.clientSecret || !intent.publishableKey) {
        setActionError("Stripe could not start card setup. Please try again or contact support.");
        return;
      }
      setCardSetup({
        clientSecret: intent.clientSecret,
        publishableKey: intent.publishableKey,
      });
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
      subtitle="Cards on file for campaign base deposits"
    >
      <section className="workspace-section">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}
        <div className="brand-billing-plan" style={{ marginBottom: 16 }}>
          <div>
            <strong>Stripe card setup</strong>
            <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
              Add a card with Stripe for approved campaign base deposits. Thesi
              stores only Stripe IDs and card metadata.
            </p>
          </div>
        </div>
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
          Cards are collected by Stripe Elements and saved for off-session
          campaign funding after the brand confirms the amount.
        </p>
      </section>

      {cardSetup ? (
        <AddPaymentMethodModal
          clientSecret={cardSetup.clientSecret}
          publishableKey={cardSetup.publishableKey}
          onClose={() => setCardSetup(null)}
          onSuccess={async () => {
            await refreshBilling();
          }}
        />
      ) : null}
    </BrandSettingsSection>
  );
}
