"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";

type CurrencyTotal = {
  currency: string;
  attributedLines: number;
  reversedLines: number;
  heldLines: number;
  underReviewCents: string;
  heldCents: string;
};

type InstallTotal = {
  currency: string;
  installEvents: number;
  heldEvents: number;
  reversedEvents: number;
  underReviewCents: string;
  heldCents: string;
};

type EarningLine = {
  orderLineId?: string;
  eventId?: string;
  campaignId: string | null;
  conversionEvent?: string;
  currency: string;
  accruedCents: string;
  state: string;
  reasons?: string[] | string;
  updatedAt: string;
};

type EarningsReport = {
  totals: CurrencyTotal[];
  installTotals?: InstallTotal[];
  settlementTotals: unknown[];
  baseTotals: unknown[];
  lines: EarningLine[];
  installLines?: EarningLine[];
  notice: string;
};

const money = (cents: string | number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    Number(cents) / 100,
  );

function sumCents<T extends Record<string, unknown>>(rows: T[], key: keyof T) {
  return rows.reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
}

function stateLabel(state: string) {
  if (state === "under_review") return "Under review";
  if (state === "held") return "Held";
  if (state === "reversed") return "Reversed";
  return state.replaceAll("_", " ");
}

function reasonText(reasons?: unknown, conversionEvent?: string) {
  const notes = Array.isArray(reasons)
    ? reasons.filter((item): item is string => typeof item === "string").join(" · ")
    : typeof reasons === "string"
      ? reasons
      : "";
  const event = conversionEvent ? conversionEvent.replaceAll("_", " ") : "";
  return [event, notes].filter(Boolean).join(" · ");
}

function formatWhen(value: string) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toLocaleString() : value;
}

function EventTable({
  caption,
  rows,
}: {
  caption: string;
  rows: EarningLine[];
}) {
  if (rows.length === 0) return null;
  return (
    <div className="crm-table-wrap">
      <table className="crm-table" aria-label={caption}>
        <thead>
          <tr>
            <th>Date</th>
            <th>Campaign</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.orderLineId ?? row.eventId ?? `${row.campaignId}-${row.updatedAt}`}>
              <td>{formatWhen(row.updatedAt)}</td>
              <td>{row.campaignId ?? "—"}</td>
              <td>{money(row.accruedCents, row.currency)}</td>
              <td>{stateLabel(row.state)}</td>
              <td className="commission-line-reasons">{reasonText(row.reasons, row.conversionEvent)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CommissionEarningsPageContent() {
  const { authenticatedRequest } = useAuth();
  const [report, setReport] = useState<EarningsReport | null>(null);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setError("");
    authenticatedRequest<EarningsReport>("/api/commission-earnings")
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Commission reporting is unavailable.");
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest, refresh]);

  const summary = useMemo(() => {
    const saleTotals = report?.totals ?? [];
    const installTotals = report?.installTotals ?? [];
    const currency = saleTotals[0]?.currency ?? installTotals[0]?.currency ?? "USD";
    const saleUnderReview = sumCents(saleTotals, "underReviewCents");
    const saleHeld = sumCents(saleTotals, "heldCents");
    const installUnderReview = sumCents(installTotals, "underReviewCents");
    const installHeld = sumCents(installTotals, "heldCents");
    return {
      currency,
      saleLines: saleTotals.reduce((sum, row) => sum + row.attributedLines, 0),
      installEvents: installTotals.reduce((sum, row) => sum + row.installEvents, 0),
      underReviewCents: saleUnderReview + installUnderReview,
      heldCents: saleHeld + installHeld,
    };
  }, [report]);

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Commission earnings</h1>
          <span className="workspace-subtitle">
            Attributed sales and app installs, with review status.
          </span>
        </div>
        <button type="button" className="crm-btn-secondary" onClick={() => setRefresh((n) => n + 1)}>
          Refresh
        </button>
      </header>
      <div className="app-content commission-stack">
        {error ? (
          <section className="app-panel" role="alert">
            <h2>Report unavailable</h2>
            <p>{error}</p>
          </section>
        ) : !report ? (
          <section className="app-panel" role="status">
            <h2>Loading report</h2>
            <p>Checking attributed earnings.</p>
          </section>
        ) : (
          <>
            <section className="app-panel">
              <h2>Summary</h2>
              <div className="crm-metric-grid">
                <div>
                  <span className="workspace-subtitle">Under review</span>
                  <strong>{money(summary.underReviewCents, summary.currency)}</strong>
                </div>
                <div>
                  <span className="workspace-subtitle">Held</span>
                  <strong>{money(summary.heldCents, summary.currency)}</strong>
                </div>
                <div>
                  <span className="workspace-subtitle">Attributed sales</span>
                  <strong>{summary.saleLines}</strong>
                </div>
                <div>
                  <span className="workspace-subtitle">Attributed installs</span>
                  <strong>{summary.installEvents}</strong>
                </div>
              </div>
              <p>{report.notice}</p>
            </section>

            <section className="app-panel">
              <h2>Install rewards</h2>
              {(report.installTotals ?? []).length === 0 ? (
                <p>No attributed installs yet.</p>
              ) : (
                (report.installTotals ?? []).map((total) => (
                  <p key={total.currency}>
                    {total.installEvents} installs · under review{" "}
                    <strong>{money(total.underReviewCents, total.currency)}</strong> · held{" "}
                    <strong>{money(total.heldCents, total.currency)}</strong>
                  </p>
                ))
              )}
              <EventTable
                caption="Install events"
                rows={report.installLines ?? []}
              />
            </section>

            <section className="app-panel">
              <h2>Attributed purchases</h2>
              {report.totals.length === 0 ? (
                <p>No attributed purchases yet.</p>
              ) : (
                report.totals.map((total) => (
                  <p key={total.currency}>
                    {total.attributedLines} order lines · under review{" "}
                    <strong>{money(total.underReviewCents, total.currency)}</strong> · held{" "}
                    <strong>{money(total.heldCents, total.currency)}</strong>
                  </p>
                ))
              )}
              <EventTable
                caption="Sale events"
                rows={report.lines}
              />
            </section>
          </>
        )}
      </div>
    </>
  );
}
