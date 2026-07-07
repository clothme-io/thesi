"use client";

import Link from "next/link";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { DEAL_STAGES, DEAL_STAGE_LABELS, formatMoney } from "@/lib/creator-crm/types";

export function PipelinePageContent() {
  const { data, ready } = useCreatorCrm();
  if (!ready) return null;

  return (
    <>
      <header className="app-topbar">
        <h1>Deal Pipeline</h1>
        <button type="button" className="crm-btn-primary">+ Add deal</button>
      </header>

      <div className="app-content">
        <div className="crm-pipeline">
          {DEAL_STAGES.map((stage) => {
            const deals = data.deals.filter((d) => d.stage === stage);
            return (
              <div key={stage} className="crm-pipeline-column">
                <h3>{DEAL_STAGE_LABELS[stage]} ({deals.length})</h3>
                {deals.map((deal) => {
                  const brand = data.brands.find((b) => b.id === deal.brandId);
                  return (
                    <div key={deal.id} className="crm-pipeline-card">
                      <strong>{deal.title}</strong>
                      <span>{brand?.name}</span>
                      <span className="crm-money">{formatMoney(deal.valueCents)}</span>
                      <Link href={`/app/brands/${deal.brandId}`} className="auth-link" style={{ fontSize: 12 }}>
                        View brand →
                      </Link>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
