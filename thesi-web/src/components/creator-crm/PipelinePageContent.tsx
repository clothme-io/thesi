"use client";

import { useState } from "react";
import Link from "next/link";
import { useCreatorCrm, moveDealStage } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import { DEAL_STAGES, DEAL_STAGE_LABELS, formatMoney, type DealStage } from "@/lib/creator-crm/types";

export function PipelinePageContent() {
  const { data, ready, persist } = useCreatorCrm();
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<DealStage | null>(null);

  if (!ready) return null;

  const handleDrop = (stage: DealStage, dealId: string) => {
    persist(moveDealStage(data, dealId, stage));
    setDraggingDealId(null);
    setDropTargetStage(null);
  };

  return (
    <>
      <header className="app-topbar">
        <h1>Deal Pipeline</h1>
        <button type="button" className="crm-btn-primary">
          + Add deal
        </button>
      </header>

      <div className="app-content">
        <p className="crm-contact-sub" style={{ marginBottom: 16 }}>
          Drag deals between columns to update stage.
        </p>
        <div className="crm-pipeline">
          {DEAL_STAGES.map((stage) => {
            const deals = data.deals.filter((d) => d.stage === stage);
            const isDropTarget = dropTargetStage === stage;

            return (
              <div
                key={stage}
                className={`crm-pipeline-column ${isDropTarget ? "crm-pipeline-column--drop-target" : ""}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDropTargetStage(stage);
                }}
                onDragLeave={(e) => {
                  if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                  setDropTargetStage((current) => (current === stage ? null : current));
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const dealId = e.dataTransfer.getData("text/deal-id");
                  if (dealId) handleDrop(stage, dealId);
                }}
              >
                <h3>
                  {DEAL_STAGE_LABELS[stage]} ({deals.length})
                </h3>
                {deals.map((deal) => {
                  const brand = data.brands.find((b) => b.id === deal.brandId);
                  const isDragging = draggingDealId === deal.id;
                  return (
                    <div
                      key={deal.id}
                      className={`crm-pipeline-card crm-pipeline-card--draggable ${isDragging ? "crm-pipeline-card--dragging" : ""}`}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/deal-id", deal.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDraggingDealId(deal.id);
                      }}
                      onDragEnd={() => {
                        setDraggingDealId(null);
                        setDropTargetStage(null);
                      }}
                    >
                      <strong>{deal.title}</strong>
                      <span>{brand?.name}</span>
                      <span className="crm-money">{formatMoney(deal.valueCents)}</span>
                      <Link
                        href={CRM_ROUTES.brand(deal.brandId)}
                        className="auth-link"
                        style={{ fontSize: 12 }}
                        draggable={false}
                        onClick={(e) => e.stopPropagation()}
                      >
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
