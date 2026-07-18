"use client";

import { useCallback, useEffect, useState } from "react";
import type { BrandBillingData, BrandBillingInfo } from "./brand-billing-types";

type AuthenticatedRequest = <T>(
  path: string,
  options?: {
    method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
    body?: unknown;
  },
) => Promise<T>;

const EMPTY: BrandBillingData = {
  billing: {
    planName: "Brand Pro",
    planPriceCents: 14900,
    billingCycle: "monthly",
    billingEmail: "",
    companyName: "",
    addressLine1: "",
    city: "",
    state: "",
    postalCode: "",
    country: "",
    nextInvoiceDate: "",
  },
  paymentMethods: [],
  paymentHistory: [],
};

export function useBrandBilling(authenticatedRequest: AuthenticatedRequest) {
  const [data, setData] = useState<BrandBillingData>(EMPTY);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setReady(false);
    setError("");
    authenticatedRequest<BrandBillingData>("/api/billing")
      .then((next) => {
        if (active) setData(next);
      })
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load billing",
          );
          setData(EMPTY);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest]);

  const updateBilling = useCallback((patch: Partial<BrandBillingInfo>) => {
    setData((prev) => ({ ...prev, billing: { ...prev.billing, ...patch } }));
    setSaved(false);
  }, []);

  const persistBilling = useCallback(
    async (billing: BrandBillingInfo) => {
      setError("");
      const next = await authenticatedRequest<BrandBillingData>("/api/billing", {
        method: "PUT",
        body: {
          billingEmail: billing.billingEmail,
          companyName: billing.companyName,
          addressLine1: billing.addressLine1,
          addressLine2: billing.addressLine2,
          city: billing.city,
          state: billing.state,
          postalCode: billing.postalCode,
          country: billing.country,
          taxId: billing.taxId,
        },
      });
      setData(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      return next;
    },
    [authenticatedRequest],
  );

  const setDefaultPaymentMethod = useCallback(
    async (id: string) => {
      setError("");
      const next = await authenticatedRequest<BrandBillingData>(
        "/api/billing/payment-methods/default",
        { method: "POST", body: { paymentMethodId: id } },
      );
      setData(next);
      return next;
    },
    [authenticatedRequest],
  );

  const createPlanInvoice = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<BrandBillingData>(
      "/api/billing/invoices",
      { method: "POST", body: {} },
    );
    setData(next);
    return next;
  }, [authenticatedRequest]);

  const refreshBilling = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<BrandBillingData>("/api/billing");
    setData(next);
    return next;
  }, [authenticatedRequest]);

  const createSetupIntent = useCallback(async () => {
    setError("");
    return authenticatedRequest<{
      clientSecret: string | null;
      setupIntentId: string;
      stripeConfigured: boolean;
    }>("/api/billing/setup-intent", { method: "POST", body: {} });
  }, [authenticatedRequest]);

  return {
    data,
    ready,
    saved,
    error,
    updateBilling,
    persistBilling,
    setDefaultPaymentMethod,
    createPlanInvoice,
    refreshBilling,
    createSetupIntent,
  };
}
