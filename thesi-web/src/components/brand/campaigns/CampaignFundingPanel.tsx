"use client";
import { useCallback, useEffect, useState } from "react";
import { getStripe } from "@/lib/stripe/stripe-client";
import { useAuth } from "@/context/AuthProvider";
import {useWorkspacePermissions} from '@/context/WorkspacePermissions';
import type { BrandCampaign } from "@/lib/brand-campaigns/types";
type Funding = {
  canRecover?: boolean;
  plan: { baseCents: number; slots: number; depositCents: number };
  fund: { state: string } | null;
  depositedCents: number;
  releasedCents: number;
  refundedCents: number;
  heldCents: number;
  unfilledSlotCents: number;
  obligations: {
    id: string;
    creatorName: string;
    amountCents: string;
    acceptedWorkAt: string | null;
    cancelledAt?: string | null;
    payoutState: string | null;
  }[];
  operations: {
    id: string;
    kind: string;
    state: string;
    error: string | null;
  }[];
};
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n / 100,
  );
export function CampaignFundingPanel({
  campaign,
}: {
  campaign: BrandCampaign;
}) {
  const { authenticatedRequest } = useAuth();
  const {canManageFunds}=useWorkspacePermissions();
  const [data, setData] = useState<Funding | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [providerId, setProviderId] = useState("");
  const [recoveryReason, setRecoveryReason] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    if(!canManageFunds)return;
    try {
      setData(
        await authenticatedRequest<Funding>(
          `/api/campaign-funding/${campaign.id}`,
        ),
      );
      setError("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not load campaign funds",
      );
    }
  }, [authenticatedRequest, campaign.id,canManageFunds]);
  useEffect(() => {
    void load();
  }, [load, campaign.status]);
  const awaitingProvider = data?.operations.some((operation) =>
    ["pending", "processing", "provider_pending"].includes(operation.state),
  );
  useEffect(() => {
    if (!awaitingProvider) return;
    const timer = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(timer);
  }, [awaitingProvider, load]);
  async function act(action: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      const result = await authenticatedRequest<Funding>(
        `/api/campaign-funding/${campaign.id}/${action}`,
        { method: "POST", body },
      );
      if (["recover", "cancel-obligation"].includes(action)) await load();
      else setData(result);
      setConfirm(false);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Funding request could not be confirmed",
      );
    } finally {
      setBusy(false);
    }
  }
  async function finishDeposit() {
    setBusy(true);
    setError("");
    try {
      const action = await authenticatedRequest<{
        status: string;
        clientSecret?: string;
        paymentMethodId?: string;
      }>(`/api/campaign-funding/${campaign.id}/deposit-action`, {
        method: "POST",
        body: {},
      });
      if (action.clientSecret) {
        const stripe = await getStripe();
        if (!stripe)
          throw new Error("Stripe checkout configuration is unavailable");
        const result = await stripe.confirmCardPayment(action.clientSecret, {
          payment_method: action.paymentMethodId,
        });
        if (result.error)
          throw new Error(
            result.error.message ?? "Payment authentication failed",
          );
      }
      const deposit=data?.operations.find(o=>o.kind==='deposit');
      if(deposit)await authenticatedRequest(`/api/campaign-funding/${campaign.id}/retry`,{method:'POST',body:{operationId:deposit.id}});
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not finish deposit");
    } finally {
      setBusy(false);
    }
  }
  if(!canManageFunds)return null;
  return (
    <section className="workspace-section" style={{ marginBottom: 24 }}>
      <h3>Campaign funding</h3>
      <p className="workspace-hint">
        Qualifying sales fund commission.{" "}
        {campaign.payment.hybrid?.base?.enabled
          ? "The brand prepays the base for each creator slot. ClothME holds it and releases each creator’s base after you accept their work. Closing the campaign returns unused slot funds; unresolved creator obligations remain held."
          : "No base payment is included, so no deposit is required."}
      </p>
      {data && (
        <>
          {data.plan.depositCents > 0 && (
            <>
              <p>
                Base deposit: {money(data.plan.baseCents)} × {data.plan.slots}{" "}
                creator slots = <strong>{money(data.plan.depositCents)}</strong>
                .
              </p>
              <p>
                Deposited: {money(data.depositedCents)} · Held:{" "}
                {money(data.heldCents)} · Released: {money(data.releasedCents)}{" "}
                · Refunded: {money(data.refundedCents)}
              </p>
              <p>
                Unused slot allocation: {money(data.unfilledSlotCents)}. Refunds
                are recorded only after the payment provider confirms them.
              </p>
              {campaign.status === "draft" &&
                (!data.fund || data.fund.state === "awaiting_deposit") && (
                  <>
                    {!confirm ? (
                      <button
                        className="crm-btn-primary"
                        disabled={busy}
                        onClick={() => setConfirm(true)}
                      >
                        Review base deposit
                      </button>
                    ) : (
                      <div>
                        <p>
                          Charge {money(data.plan.depositCents)} to your default
                          saved payment method for this brand’s campaign? This
                          locks the campaign’s payment terms and creator slots.
                          Save any draft edits before funding.
                        </p>
                        <button
                          className="crm-btn-primary"
                          disabled={busy}
                          onClick={() =>
                            void act("deposit", {
                              expectedAmountCents: data.plan.depositCents,
                            })
                          }
                        >
                          Confirm {money(data.plan.depositCents)} deposit
                        </button>{" "}
                        <button
                          className="crm-btn-secondary"
                          disabled={busy}
                          onClick={() => setConfirm(false)}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </>
                )}
              {data.obligations.map((o) => (
                <div key={o.id} style={{ marginTop: 16 }}>
                  <strong>{o.creatorName}</strong> —{" "}
                  {money(Number(o.amountCents))} base —{" "}
                  {o.payoutState?.replaceAll("_", " ") ??
                    "Awaiting work acceptance"}
                  {!o.acceptedWorkAt && !o.cancelledAt && (
                    <>
                      <label className="workspace-field">
                        <span>Work accepted for {o.creatorName}</span>
                        <textarea
                          maxLength={2000}
                          value={notes[o.id] ?? ""}
                          placeholder="Identify the delivered content you have reviewed and accepted."
                          onChange={(e) =>
                            setNotes({ ...notes, [o.id]: e.target.value })
                          }
                        />
                      </label>
                      <button
                        className="crm-btn-primary"
                        disabled={busy || !notes[o.id]?.trim()}
                        onClick={() =>
                          void act("accept-work", {
                            obligationId: o.id,
                            note: notes[o.id],
                          })
                        }
                      >
                        Accept work and release {money(Number(o.amountCents))}
                      </button>
                    </>
                  )}
                </div>
              ))}
            </>
          )}
          {data.fund?.state === "awaiting_deposit" && (
            <button
              className="crm-btn-secondary"
              disabled={busy}
              onClick={() => void finishDeposit()}
            >
              Finish payment / use updated default card
            </button>
          )}
          {data.canRecover && (
            <details>
              <summary>Funding operations recovery</summary>
              <label className="workspace-field">
                <span>Recovery reason or verified cancellation evidence</span>
                <textarea
                  value={recoveryReason}
                  onChange={(e) => setRecoveryReason(e.target.value)}
                  maxLength={2000}
                />
              </label>
              <label className="workspace-field">
                <span>Stripe payment, transfer, or refund ID</span>
                <input
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                />
              </label>
              {data.operations
                .filter((o) => o.state !== "succeeded")
                .map((o) => (
                  <p key={o.id}>
                    {o.kind}: {o.state}{" "}
                    <button
                      disabled={busy || !providerId || !recoveryReason.trim()}
                      onClick={() =>
                        void act("recover", {
                          operationId: o.id,
                          providerId,
                          reason: recoveryReason,
                          mode: "verify",
                        })
                      }
                    >
                      Verify provider outcome
                    </button>{" "}
                    {o.kind.startsWith("refund") && (
                      <button
                        disabled={busy || !recoveryReason.trim()}
                        onClick={() =>
                          void act("recover", {
                            operationId: o.id,
                            providerId: "verify-known-refund",
                            reason: recoveryReason,
                            mode: "retry_refund",
                          })
                        }
                      >
                        Retry verified failed refund
                      </button>
                    )}
                  </p>
                ))}
              {data.obligations
                .filter((o) => !o.acceptedWorkAt && !o.cancelledAt)
                .map((o) => (
                  <p key={o.id}>
                    <button
                      disabled={busy || recoveryReason.trim().length < 10}
                      onClick={() =>
                        void act("cancel-obligation", {
                          obligationId: o.id,
                          note: recoveryReason,
                        })
                      }
                    >
                      Resolve cancellation and refund {o.creatorName}’s base
                    </button>
                  </p>
                ))}
            </details>
          )}
          {data.operations
            .filter((o) => o.state !== "succeeded")
            .map((o) => (
              <p key={o.id}>
                {o.kind.replaceAll("_", " ")}: {o.state.replaceAll("_", " ")}.{" "}
                {o.error}{" "}
                {o.state !== "review" && (
                  <button
                    disabled={busy}
                    className="crm-btn-secondary"
                    onClick={() => void act("retry", { operationId: o.id })}
                  >
                    Check / retry
                  </button>
                )}
              </p>
            ))}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        className="crm-btn-secondary"
        disabled={busy}
        onClick={() => void load()}
      >
        Refresh funding status
      </button>
    </section>
  );
}
