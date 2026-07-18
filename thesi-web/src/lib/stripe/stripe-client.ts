"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { getStripePublishableKey } from "./publishable-key";

let stripePromise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  const key = getStripePublishableKey();
  if (!key) return Promise.resolve(null);
  if (!stripePromise) {
    stripePromise = loadStripe(key);
  }
  return stripePromise;
}
