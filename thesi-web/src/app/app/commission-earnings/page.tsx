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
  const [selectedLine,setSelectedLine]=useState<string|null>(null);
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
    <main className="commission-report">
      <header>
        <div>
          <p className="commission-eyebrow">CAMPAIGN PERFORMANCE</p>
          <h1>Commission earnings</h1>
          <p>Verified attributed purchases, with refunds and review status.</p>
        </div>
        <button type="button" onClick={() => setRefresh((n) => n + 1)}>
          Refresh
        </button>
      </header>
      <aside>
        Estimates require qualification. Open a sale’s settlement to see confirmed payments and adjustments. Base content
        payments are separate. Payment and refund updates may take time to
        appear.
      </aside>
      {error ? (
        <p role="alert">{error}</p>
      ) : !report ? (
        <p role="status">Loading commission report…</p>
      ) : (
        <>
          {!report.totals.length ? (
            <section>
              <h2>No attributed purchases yet</h2>
              <p>
                After an accepted creator link leads to a verified purchase, its
                commission estimate will appear here.
              </p>
            </section>
          ) : (
            report.totals.map((t) => (
              <section key={t.currency}>
                <h2>{t.currency} commission</h2>
                <div className="commission-metrics">
                  <div>
                    <span>Under review</span>
                    <strong>{money(t.underReviewCents, t.currency)}</strong>
                  </div>
                  <div>
                    <span>Held for reconciliation</span>
                    <strong>{money(t.heldCents, t.currency)}</strong>
                    <small>{t.heldLines} order lines</small>
                  </div>
                  <div>
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
              <h2>Confirmed payment movement</h2>
              {(report.settlementTotals ?? []).map((t) => (
                <div className="commission-metrics" key={t.currency}>
                  <div>
                    <span>Commission paid</span>
                    <strong>
                      {money(t.confirmedCommissionNetPaidCents, t.currency)}
                    </strong>
                    <small>
                      {money(t.confirmedCommissionRecoveredCents, t.currency)}{" "}
                      recovered
                    </small>
                  </div>
                  <div>
                    <span>Applied to refunds</span>
                    <strong>{money(t.confirmedRefundOffsetCents, t.currency)}</strong>
                  </div>
                  <div>
                    <span>Returned to brand</span>
                    <strong>
                      {money(t.confirmedVendorReturnedCents, t.currency)}
                    </strong>
                  </div>
                </div>
              ))}
              {(report.baseTotals ?? []).map((t) => (
                <div className="commission-metrics" key={`base-${t.currency}`}>
                  <div>
                    <span>Base deposited</span>
                    <strong>{money(t.depositedCents, t.currency)}</strong>
                    <small>
                      {money(t.plannedDepositCents, t.currency)} planned
                    </small>
                  </div>
                  <div>
                    <span>Base released</span>
                    <strong>{money(t.releasedBaseCents, t.currency)}</strong>
                    <small>{t.baseObligations} creator obligations</small>
                  </div>
                  <div>
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
          {selectedLine&&<CommissionSettlementPanel key={selectedLine} orderLineId={selectedLine}/>}
          <section>
            <h2>Recent order lines</h2>
            <p>
              Latest {report.limit} lines at most. Totals include all your
              attributed lines. Dates show when each calculation was recorded.
            </p>
            <div className="commission-table">
              <table>
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
                        <span title={l.orderLineId}>
                          <button onClick={()=>setSelectedLine(l.orderLineId)}>{l.orderLineId.slice(0, 8)} · Settlement</button>
                        </span>
                      </td>
                      <td>{money(l.accruedCents, l.currency)}</td>
                      <td>
                        {l.state.replaceAll("_", " ")}
                        {l.reasons.length > 0 && (
                          <small>
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
        </>
      )}
    </main>
  );
}
