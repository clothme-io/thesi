"use client";

import { useCallback, useEffect, useState } from "react";
import { SEED_BRAND_BILLING_DATA } from "./brand-billing-seed";
import type { BrandBillingData, BrandBillingInfo } from "./brand-billing-types";

const STORAGE_KEY = "thesi_brand_billing";

export function loadBrandBillingData(): BrandBillingData {
  if (typeof window === "undefined") return SEED_BRAND_BILLING_DATA;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_BRAND_BILLING_DATA));
    return SEED_BRAND_BILLING_DATA;
  }
  try {
    return JSON.parse(raw) as BrandBillingData;
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_BRAND_BILLING_DATA));
    return SEED_BRAND_BILLING_DATA;
  }
}

export function saveBrandBillingData(data: BrandBillingData) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useBrandBilling() {
  const [data, setData] = useState<BrandBillingData>(SEED_BRAND_BILLING_DATA);
  const [ready, setReady] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setData(loadBrandBillingData());
    setReady(true);
  }, []);

  const updateBilling = useCallback((patch: Partial<BrandBillingInfo>) => {
    setData((prev) => ({ ...prev, billing: { ...prev.billing, ...patch } }));
    setSaved(false);
  }, []);

  const persistBilling = useCallback((billing: BrandBillingInfo) => {
    setData((prev) => {
      const next = { ...prev, billing };
      saveBrandBillingData(next);
      return next;
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }, []);

  const setDefaultPaymentMethod = useCallback((id: string) => {
    setData((prev) => {
      const next: BrandBillingData = {
        ...prev,
        paymentMethods: prev.paymentMethods.map((pm) => ({
          ...pm,
          isDefault: pm.id === id,
        })),
      };
      saveBrandBillingData(next);
      return next;
    });
  }, []);

  return { data, ready, saved, updateBilling, persistBilling, setDefaultPaymentMethod };
}
