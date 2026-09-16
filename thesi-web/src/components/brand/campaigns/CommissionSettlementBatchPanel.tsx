"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useWorkspacePermissions } from "@/context/WorkspacePermissions";

type BatchLine = {
  orderLineId: string;
  creatorId: string;
  currency: string;
  earnedCents: string;
  netPaidCents: string;
  eligibleAt: string | null;
  ready: boolean;
  reasons: string[];
};

type BatchPreview = {
  workspaceId: string;
  readyCount: number;
  readyCents: string;
  currency: string;
  lines: BatchLine[];
  limit: number;
};

type BatchStatus = {
  id: string;
  state: string;
  totals: Record<string, number>;
  items: {
    orderLineId: string;
    requestId: string;
    state: string;
    error: string | null;
  }[];
};

const money = (value: string | number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Number(value) / 100,
  );

export function CommissionSettlementBatchPanel() {
  const { authenticatedRequest, session } = useAuth();
  const { canManageFunds } = useWorkspacePermissions();
  const [preview, setPreview] = useState<BatchPreview | null>(null);
  const [result, setResult] = useState<BatchStatus | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const owner = session?.user.role === "brand" && canManageFunds;
  const readyLines = useMemo(
    () => preview?.lines.filter((line) => line.ready) ?? [],
    [preview?.lines],
  );

  const load = useCallback(async () => {
    if (!owner) return;
    setBusy(true);
    setError("");
    try {
      setPreview(
        await authenticatedRequest<BatchPreview>(
          "/api/commission-settlement-batches/preview",
        ),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch preview unavailable");
    } finally {
      setBusy(false);
    }
  }, [authenticatedRequest, owner]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runBatch() {
    setBusy(true);
    setError("");
    try {
      setResult(
        await authenticatedRequest<BatchStatus>(
          "/api/commission-settlement-batches",
          {
            method: "POST",
            body: {
              batchId: crypto.randomUUID(),
              reason,
              lineIds: readyLines.map((line) => line.orderLineId),
            },
          },
        ),
      );
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Batch settlement failed");
    } finally {
      setBusy(false);
    }
  }

  if (!owner) return null;

  return (
    <section className="workspace-section commission-batch">
      <div className="commission-batch__header">
        <div>
          <h2>Batch settlement</h2>
          <p>
            Qualify ready commission lines together after reviewing the accepted
            terms. Each item still receives its own audit record and payout
            operation.
          </p>
        </div>
        <button
          type="button"
          className="crm-btn-secondary"
          disabled={busy}
          onClick={() => void load()}
        >
          Refresh ready lines
        </button>
      </div>

      {preview && (
        <div className="crm-dashboard-grid">
          <div className="app-stat-card">
            <span>Ready lines</span>
            <strong>{preview.readyCount}</strong>
            <small>{preview.limit} lines checked</small>
          </div>
          <div className="app-stat-card">
            <span>Ready commission</span>
            <strong>{money(preview.readyCents, preview.currency)}</strong>
            <small>Net of confirmed creator payments</small>
          </div>
          <div className="app-stat-card">
            <span>Blocked / waiting</span>
            <strong>{preview.lines.length - preview.readyCount}</strong>
            <small>Open holds stay out of the batch</small>
          </div>
        </div>
      )}

      <label className="workspace-field">
        <span>Batch review reason</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={2000}
          placeholder="Confirm that the selected sales are past review, match the accepted campaign terms, and have no open holds."
        />
      </label>
      <div className="commission-batch__actions">
        <button
          type="button"
          className="crm-btn-primary"
          disabled={busy || !reason.trim() || readyLines.length === 0}
          onClick={() => void runBatch()}
        >
          Qualify ready commission lines
        </button>
      </div>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {preview && preview.lines.length > 0 && (
        <div className="crm-table-wrap" style={{ marginTop: 20 }}>
          <table className="crm-table">
            <thead>
              <tr>
                <th>Order line</th>
                <th>Commission</th>
                <th>Batch status</th>
              </tr>
            </thead>
            <tbody>
              {preview.lines.slice(0, 8).map((line) => (
                <tr key={line.orderLineId}>
                  <td>{line.orderLineId.slice(0, 8)}</td>
                  <td>{money(line.earnedCents, line.currency)}</td>
                  <td>
                    {line.ready ? "Ready" : "Waiting"}
                    {line.reasons.length > 0 && (
                      <small className="commission-line-reasons">
                        {line.reasons
                          .map((reasonText) => reasonText.replaceAll("_", " "))
                          .join("; ")}
                      </small>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result && (
        <div className="commission-batch__result">
          <h3>Last batch</h3>
          <p>
            {result.state} · {result.totals.confirmed ?? 0} confirmed ·{" "}
            {result.totals.failed ?? 0} failed · {result.totals.skipped ?? 0}{" "}
            skipped
          </p>
          {result.items
            .filter((item) => item.state !== "confirmed")
            .slice(0, 5)
            .map((item) => (
              <p key={item.requestId}>
                {item.orderLineId.slice(0, 8)} · {item.state}
                {item.error ? ` · ${item.error}` : ""}
              </p>
            ))}
        </div>
      )}
    </section>
  );
}
