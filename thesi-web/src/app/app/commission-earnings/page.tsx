"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import "./earnings.css";
import { CommissionSettlementBatchPanel } from "@/components/brand/campaigns/CommissionSettlementBatchPanel";
import { CommissionSettlementPanel } from "@/components/brand/campaigns/CommissionSettlementPanel";
type Report = {
  notice: string;
  totals: {
    currency: string;
    attributedLines: number;
    reversedLines: number;
    heldLines: number;
    underReviewCents: string;
    heldCents: string;
  }[];
  settlementTotals: {
    currency: string;
    confirmedCommissionPaidCents: string;
    confirmedCommissionRecoveredCents: string;
    confirmedCommissionNetPaidCents: string;
    confirmedRefundOffsetCents: string;
    confirmedVendorReturnedCents: string;
  }[];
  baseTotals: {
    currency: string;
    plannedDepositCents: string;
    depositedCents: string;
    unusedRefundedCents: string;
    baseObligations: number;
    baseObligationCents: string;
    releasedBaseCents: string;
    cancelledBaseRefundCents: string;
  }[];
  lines: {
    orderLineId: string;
    campaignId: string;
    currency: string;
    accruedCents: string;
    state: string;
    reasons: string[];
    updatedAt: string;
  }[];
  limit: number;
};
export default function CommissionEarningsPage() {
  const { authenticatedRequest, session } = useAuth();
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState("");
  const [selectedLine, setSelectedLine] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setReport(null);
    setError("");
    if (!session || !["creator", "brand"].includes(session.user.role)) return;
    authenticatedRequest<Report>("/api/commission-earnings")
      .then((r) => {
        if (active) setReport(r);
      })
      .catch(() => {
        if (active)
          setError("Commission reporting is unavailable. Please try again.");
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest, session, refresh]);
  const money = (value: string, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
      Number(value) / 100,
    );
  const addCents = (...values: string[]) =>
    values.reduce((sum, value) => sum + Number(value), 0).toString();
  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Commission earnings</h1>
          <span className="workspace-subtitle">
            Verified attributed purchases, with refunds and review status.
          </span>
        </div>
        <button
          type="button"
          className="crm-btn-primary"
          onClick={() => setRefresh((n) => n + 1)}
        >
          Refresh
        </button>
      </header>
      <div className="app-content">
        <p className="workspace-hint" style={{ marginTop: 0, marginBottom: 20 }}>
          Estimates require qualification. Open a sale’s settlement to see
          confirmed payments and adjustments. Base content payments are
          separate. Payment and refund updates may take time to appear.
        </p>
        {error ? (
          <p className="auth-error" role="alert">
            {error}
          </p>
        ) : !report ? (
          <p className="workspace-hint" role="status">
            Loading commission report…
          </p>
        ) : (
          <div className="commission-stack">
            {!report.totals.length ? (
              <section className="app-panel">
                <h2>No attributed purchases yet</h2>
                <p>
                  After an accepted creator link leads to a verified purchase,
                  its commission estimate will appear here.
                </p>
              </section>
            ) : (
              report.totals.map((t) => (
                <section key={t.currency}>
                  <h2 className="crm-section-title">
                    {t.currency} commission
                  </h2>
                  <div
                    className="crm-dashboard-grid"
                    style={{ marginBottom: 0 }}
                  >
                    <div className="app-stat-card">
                      <span>Under review</span>
                      <strong>{money(t.underReviewCents, t.currency)}</strong>
                    </div>
                    <div className="app-stat-card">
                      <span>Held for reconciliation</span>
                      <strong>{money(t.heldCents, t.currency)}</strong>
                      <small>{t.heldLines} order lines</small>
                    </div>
                    <div className="app-stat-card">
                      <span>Attributed order lines</span>
                      <strong>{t.attributedLines}</strong>
                      <small>{t.reversedLines} fully refunded</small>
                    </div>
                  </div>
                </section>
              ))
            )}
            {((report.settlementTotals ?? []).length > 0 ||
              (report.baseTotals ?? []).length > 0) && (
              <section>
                <h2 className="crm-section-title">Confirmed payment movement</h2>
                {(report.settlementTotals ?? []).map((t) => (
                  <div
                    className="crm-dashboard-grid"
                    key={t.currency}
                    style={{ marginBottom: 16 }}
                  >
                    <div className="app-stat-card">
                      <span>Commission paid</span>
                      <strong>
                        {money(t.confirmedCommissionNetPaidCents, t.currency)}
                      </strong>
                      <small>
                        {money(t.confirmedCommissionRecoveredCents, t.currency)}{" "}
                        recovered
                      </small>
                    </div>
                    <div className="app-stat-card">
                      <span>Applied to refunds</span>
                      <strong>
                        {money(t.confirmedRefundOffsetCents, t.currency)}
                      </strong>
                    </div>
                    <div className="app-stat-card">
                      <span>Returned to brand</span>
                      <strong>
                        {money(t.confirmedVendorReturnedCents, t.currency)}
                      </strong>
                    </div>
                  </div>
                ))}
                {(report.baseTotals ?? []).map((t) => (
                  <div
                    className="crm-dashboard-grid"
                    key={`base-${t.currency}`}
                    style={{ marginBottom: 0 }}
                  >
                    <div className="app-stat-card">
                      <span>Base deposited</span>
                      <strong>{money(t.depositedCents, t.currency)}</strong>
                      <small>
                        {money(t.plannedDepositCents, t.currency)} planned
                      </small>
                    </div>
                    <div className="app-stat-card">
                      <span>Base released</span>
                      <strong>{money(t.releasedBaseCents, t.currency)}</strong>
                      <small>{t.baseObligations} creator obligations</small>
                    </div>
                    <div className="app-stat-card">
                      <span>Base refunded</span>
                      <strong>
                        {money(
                          addCents(
                            t.unusedRefundedCents,
                            t.cancelledBaseRefundCents,
                          ),
                          t.currency,
                        )}
                      </strong>
                    </div>
                  </div>
                ))}
              </section>
            )}
            <CommissionSettlementBatchPanel />
            {selectedLine && (
              <CommissionSettlementPanel
                key={selectedLine}
                orderLineId={selectedLine}
              />
            )}
            <section>
              <h2 className="crm-section-title">Recent order lines</h2>
              <p className="workspace-hint" style={{ margin: "0 0 16px" }}>
                Latest {report.limit} lines at most. Totals include all your
                attributed lines. Dates show when each calculation was recorded.
              </p>
              <div className="crm-table-wrap">
                <table className="crm-table">
                  <thead>
                    <tr>
                      <th>Order line</th>
                      <th>Estimate</th>
                      <th>Status</th>
                      <th>Recorded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.lines.map((l) => (
                      <tr key={l.orderLineId}>
                        <td>
                          <button
                            type="button"
                            className="inbox-btn-text"
                            title={l.orderLineId}
                            onClick={() => setSelectedLine(l.orderLineId)}
                          >
                            {l.orderLineId.slice(0, 8)} · Settlement
                          </button>
                        </td>
                        <td>{money(l.accruedCents, l.currency)}</td>
                        <td>
                          {l.state.replaceAll("_", " ")}
                          {l.reasons.length > 0 && (
                            <small className="commission-line-reasons">
                              {l.reasons
                                .map((r) => r.replaceAll("_", " "))
                                .join("; ")}
                            </small>
                          )}
                        </td>
                        <td>{new Date(l.updatedAt).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}
