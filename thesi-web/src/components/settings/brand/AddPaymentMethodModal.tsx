"use client";

import { FormEvent, useState } from "react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { getStripe } from "@/lib/stripe/stripe-client";

type Props = {
  clientSecret: string;
  onClose: () => void;
  onSuccess: () => Promise<void> | void;
};

function AddCardForm({ onClose, onSuccess }: Omit<Props, "clientSecret">) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setError("");

    const result = await stripe.confirmSetup({
      elements,
      redirect: "if_required",
    });

    if (result.error) {
      setError(result.error.message || "Could not save this card.");
      setSubmitting(false);
      return;
    }

    const status = result.setupIntent?.status;
    if (status !== "succeeded" && status !== "processing") {
      setError("Card setup did not complete. Try again.");
      setSubmitting(false);
      return;
    }

    try {
      await onSuccess();
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Card saved, but the list could not be refreshed.",
      );
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <PaymentElement
        options={{
          layout: "tabs",
        }}
      />
      {error ? (
        <p className="workspace-hint" style={{ marginTop: 12 }}>
          {error}
        </p>
      ) : null}
      <div className="marketplace-modal-footer">
        <button
          type="button"
          className="crm-btn-secondary"
          onClick={onClose}
          disabled={submitting}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="crm-btn-primary"
          disabled={!stripe || !elements || submitting}
        >
          {submitting ? "Saving…" : "Save card"}
        </button>
      </div>
    </form>
  );
}

export function AddPaymentMethodModal({
  clientSecret,
  onClose,
  onSuccess,
}: Props) {
  return (
    <div
      className="marketplace-modal-backdrop"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="marketplace-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Add payment method"
      >
        <h2>Add payment method</h2>
        <p className="workspace-hint" style={{ marginBottom: 16 }}>
          Your card is saved securely with Stripe for subscriptions and invoices.
        </p>
        <Elements
          stripe={getStripe()}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
              variables: {
                colorPrimary: "#1599e3",
                colorText: "#0f4e71",
                colorDanger: "#f87979",
                borderRadius: "10px",
                fontFamily: "Inter, system-ui, sans-serif",
              },
            },
          }}
        >
          <AddCardForm onClose={onClose} onSuccess={onSuccess} />
        </Elements>
      </div>
    </div>
  );
}
