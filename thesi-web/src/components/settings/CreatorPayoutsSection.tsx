"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import {
  CONNECT_STATUS_LABELS,
  type ConnectStatus,
} from "@/lib/connect/types";

const EMPTY: ConnectStatus = {
  stripeConfigured: false,
  status: "unavailable",
  accountId: null,
  detailsSubmitted: false,
  chargesEnabled: false,
  payoutsEnabled: false,
  readyForPayouts: false,
};

export function CreatorPayoutsSection() {
  const { authenticatedRequest } = useAuth();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<ConnectStatus>(EMPTY);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const next = await authenticatedRequest<ConnectStatus>("/api/connect/status");
    setStatus(next);
    return next;
  }, [authenticatedRequest]);

  useEffect(() => {
    let active = true;
    setReady(false);
    load()
      .catch((requestError) => {
        if (active) {
          setError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load payout status",
          );
          setStatus(EMPTY);
        }
      })
      .finally(() => {
        if (active) setReady(true);
      });
    return () => {
      active = false;
    };
  }, [load]);

  useEffect(() => {
    const flag = searchParams.get("connect");
    if (flag === "return" || flag === "refresh") {
      load().catch(() => {
        // Keep prior status if refresh fails.
      });
    }
  }, [searchParams, load]);

  const startOnboarding = async () => {
    setBusy(true);
    setError("");
    try {
      const origin = window.location.origin;
      const link = await authenticatedRequest<{ url: string }>(
        "/api/connect/account-link",
        {
          method: "POST",
          body: {
            refreshUrl: `${origin}/app/settings?connect=refresh`,
            returnUrl: `${origin}/app/settings?connect=return`,
          },
        },
      );
      if (!link.url) {
        throw new Error("Stripe did not return an onboarding URL");
      }
      window.location.href = link.url;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not start Stripe onboarding",
      );
      setBusy(false);
    }
  };

  const openDashboard = async () => {
    setBusy(true);
    setError("");
    try {
      const link = await authenticatedRequest<{ url: string }>(
        "/api/connect/login-link",
        { method: "POST", body: {} },
      );
      if (!link.url) {
        throw new Error("Stripe dashboard is unavailable");
      }
      window.location.href = link.url;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not open Stripe dashboard",
      );
      setBusy(false);
    }
  };

  if (!ready) return null;

  return (
    <section className="workspace-section">
      <h3>Payouts</h3>
      <p className="workspace-hint" style={{ marginTop: 0 }}>
        Connect a Stripe Express account to receive campaign payouts. Brands
        pay you from the campaign page once this account is ready.
      </p>

      {error ? (
        <p className="workspace-hint" style={{ marginBottom: 12 }}>
          {error}
        </p>
      ) : null}

      <div className="brand-billing-plan" style={{ marginTop: 12 }}>
        <div>
          <strong>{CONNECT_STATUS_LABELS[status.status]}</strong>
          <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
            {status.readyForPayouts
              ? "Payouts enabled on your Stripe Express account."
              : status.status === "unavailable"
                ? "Set STRIPE_SECRET_KEY on thesi-api to enable Connect."
                : status.status === "pending"
                  ? "Finish Stripe onboarding to enable payouts."
                  : "Start Stripe Connect to add your payout details."}
          </p>
          {status.accountId ? (
            <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
              Account: {status.accountId}
            </p>
          ) : null}
        </div>
        <span className="crm-tag">
          {status.readyForPayouts ? "Ready" : "Action needed"}
        </span>
      </div>

      <div className="brand-payment-method-actions" style={{ marginTop: 16 }}>
        {status.status !== "unavailable" && !status.readyForPayouts ? (
          <button
            type="button"
            className="crm-btn-primary"
            onClick={startOnboarding}
            disabled={busy}
          >
            {busy
              ? "Opening Stripe…"
              : status.status === "pending"
                ? "Continue Stripe setup"
                : "Set up payouts"}
          </button>
        ) : null}
        {status.readyForPayouts ? (
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={openDashboard}
            disabled={busy}
          >
            {busy ? "Opening…" : "Open Stripe dashboard"}
          </button>
        ) : null}
        {status.status !== "unavailable" ? (
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() =>
              load().catch((requestError) =>
                setError(
                  requestError instanceof Error
                    ? requestError.message
                    : "Could not refresh status",
                ),
              )
            }
            disabled={busy}
          >
            Refresh status
          </button>
        ) : null}
      </div>
    </section>
  );
}
