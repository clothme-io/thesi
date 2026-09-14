"use client";
import {
  commissionRulesText,
  type CommissionRules,
} from "@/lib/brand-campaigns/commission-rules";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useWorkspacePermissions } from "@/context/WorkspacePermissions";
type Settlement = {
  rules?: CommissionRules;
  riskReviewEnabled?: boolean;
  revision: number;
  earnedCents: number;
  eligibleAt: string;
  holdReasons: string[];
  canRecover: boolean;
  disqualified: boolean;
  totals: {
    reserved: number;
    creatorPaid: number;
    creatorRecovered: number;
    vendorReturned: number;
    vendorRecovered: number;
    refundOffset: number;
  };
  operations: {
    id: string;
    kind: string;
    amountCents: string;
    state: string;
    error: string | null;
    providerId: string | null;
  }[];
  requests: { id: string; state: string; error: string | null }[];
};
const money = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    n / 100,
  );
export function CommissionSettlementPanel({
  orderLineId,
}: {
  orderLineId: string;
}) {
  const { authenticatedRequest, session } = useAuth();
  const { canManageFunds } = useWorkspacePermissions();
  const [data, setData] = useState<Settlement | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState("");
  const [providerId, setProviderId] = useState("");
  const [action, setAction] = useState<
    "qualify" | "disqualify" | "reconcile" | null
  >(null);
  const load = useCallback(async () => {
    if (session?.user.role === "brand" && !canManageFunds) return;
    try {
      setData(
        await authenticatedRequest<Settlement>(
          `/api/commission-settlement/${orderLineId}`,
        ),
      );
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Settlement unavailable");
    }
  }, [authenticatedRequest, orderLineId, canManageFunds, session?.user.role]);
  useEffect(() => {
    void load();
  }, [load]);
  async function run(path: string, body: unknown) {
    setBusy(true);
    setError("");
    try {
      setData(
        await authenticatedRequest<Settlement>(
          `/api/commission-settlement/${orderLineId}/${path}`,
          { method: "POST", body },
        ),
      );
      setAction(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Confirmation pending");
    } finally {
      setBusy(false);
    }
  }
  const write =
    (session?.user.role === "brand" && canManageFunds) || data?.canRecover;
  if (session?.user.role === "brand" && !canManageFunds) return null;
  return (
    <section
      className="workspace-section"
      style={{
        padding: 20,
        border: "1px solid #ddd",
        borderRadius: 12,
        margin: "16px 0",
      }}
    >
      <h2>Commission settlement</h2>
      <p>
        Sale {orderLineId.slice(0, 8)} · Base content payments are separate.
      </p>
      {data && (
        <>
          <p>
            Reserved from sale: <strong>{money(data.totals.reserved)}</strong> ·
            Current commission: <strong>{money(data.earnedCents)}</strong>
          </p>
          <p>
            Paid to creator:{" "}
            {money(data.totals.creatorPaid - data.totals.creatorRecovered)} ·
            Returned to brand:{" "}
            {money(data.totals.vendorReturned - data.totals.vendorRecovered)} ·
            Applied to customer refunds: {money(data.totals.refundOffset)}
          </p>
          <p>
            Earliest qualification: {new Date(data.eligibleAt).toLocaleString()}
            . Qualification also requires review of the accepted campaign terms.
          </p>
          {data.rules && <p>{commissionRulesText(data.rules)}</p>}
          {!!data.holdReasons.length && (
            <p role="status">
              Held:{" "}
              {data.holdReasons.map((r) => r.replaceAll("_", " ")).join("; ")}
            </p>
          )}
          {data.disqualified && (
            <p>
              This sale was disqualified. Its decision remains in the audit
              history.
            </p>
          )}
          {write && (
            <>
              <label className="workspace-field">
                <span>Review / recovery reason</span>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  maxLength={2000}
                  placeholder="Confirm the agreed eligibility and return conditions, or explain the adjustment."
                />
              </label>
              {data.riskReviewEnabled && (
                <div>
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      run("risk", {
                        requestId: crypto.randomUUID(),
                        expectedRevision: data.revision,
                        status: "hold",
                        kind: "suspected_self_referral",
                        reason,
                      })
                    }
                  >
                    Flag suspected self-referral
                  </button>
                  <button
                    type="button"
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      run("risk", {
                        requestId: crypto.randomUUID(),
                        expectedRevision: data.revision,
                        status: "hold",
                        kind: "fraud",
                        reason,
                      })
                    }
                  >
                    Flag suspected fraud
                  </button>
                  {data.canRecover && (
                    <button
                      type="button"
                      disabled={busy || !reason.trim()}
                      onClick={() =>
                        run("risk", {
                          requestId: crypto.randomUUID(),
                          expectedRevision: data.revision,
                          status: "clear",
                          kind: "fraud",
                          reason,
                        })
                      }
                    >
                      Clear risk hold with evidence
                    </button>
                  )}
                  <p>
                    ClothME operators review risk flags. Clearing a flag does
                    not clear payment, credit or refund holds.
                  </p>
                </div>
              )}
              {action ? (
                <div>
                  <p>
                    {action === "qualify"
                      ? `Confirm eligibility for ${money(data.earnedCents)} commission? Any required reserve adjustments run before a transfer.`
                      : action === "disqualify"
                        ? "Confirm that this sale fails the accepted campaign terms? Prior payments may need recovery."
                        : "Apply the next verified refund or recovery adjustment?"}
                  </p>
                  <button
                    disabled={busy || !reason.trim()}
                    onClick={() =>
                      void run("decide", {
                        requestId: crypto.randomUUID(),
                        expectedRevision: data.revision,
                        action,
                        reason,
                      })
                    }
                  >
                    Confirm {action}
                  </button>{" "}
                  <button disabled={busy} onClick={() => setAction(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div>
                  <button
                    disabled={
                      busy ||
                      !!data.holdReasons.length ||
                      data.disqualified ||
                      Date.now() < Date.parse(data.eligibleAt)
                    }
                    onClick={() => setAction("qualify")}
                  >
                    Review and qualify
                  </button>{" "}
                  <button
                    disabled={
                      busy || !!data.holdReasons.length || data.disqualified
                    }
                    onClick={() => setAction("disqualify")}
                  >
                    Disqualify sale
                  </button>{" "}
                  <button
                    disabled={busy || !!data.holdReasons.length}
                    onClick={() => setAction("reconcile")}
                  >
                    Reconcile adjustments
                  </button>
                </div>
              )}
              {data.requests
                .filter((r) => r.state === "pending")
                .map((r) => (
                  <p key={r.id}>
                    {r.error ?? "Approval confirmation pending"}{" "}
                    <button
                      disabled={busy}
                      onClick={() => void run("replay", { requestId: r.id })}
                    >
                      Replay existing approval
                    </button>
                  </p>
                ))}
            </>
          )}
          {data.operations.map((o) => (
            <div key={o.id} style={{ marginTop: 12 }}>
              {o.kind.replaceAll("_", " ")} · {money(Number(o.amountCents))} ·{" "}
              {o.state} {o.error && <p>{o.error}</p>}
              {write && ["pending", "processing"].includes(o.state) && (
                <button
                  disabled={busy}
                  onClick={() => void run("retry", { operationId: o.id })}
                >
                  Retry existing operation
                </button>
              )}
              {data.canRecover &&
                ["pending", "review", "processing"].includes(o.state) && (
                  <label className="workspace-field">
                    <span>Verified Stripe transfer / reversal ID</span>
                    <input
                      value={providerId}
                      onChange={(e) => setProviderId(e.target.value)}
                    />
                    <button
                      disabled={busy || !providerId.trim() || !reason.trim()}
                      onClick={() =>
                        void run("recover", {
                          operationId: o.id,
                          providerId,
                          reason,
                        })
                      }
                    >
                      Verify provider outcome
                    </button>
                  </label>
                )}
            </div>
          ))}
        </>
      )}
      {error && <p role="alert">{error}</p>}
      <button disabled={busy} onClick={() => void load()}>
        Refresh settlement
      </button>
    </section>
  );
}
