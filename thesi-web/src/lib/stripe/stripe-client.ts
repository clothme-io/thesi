"use client";

import { loadStripe, type Stripe } from "@stripe/stripe-js";
const stripePromises = new Map<string, Promise<Stripe | null>>();

export function getStripe(publishableKey: string): Promise<Stripe | null> {
  let stripePromise = stripePromises.get(publishableKey);
  if (!stripePromise) {
    stripePromise = loadStripe(publishableKey);
    stripePromises.set(publishableKey, stripePromise);
  }
  return stripePromise;
}
