"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import {
  DEAL_STAGES,
  DEAL_STAGE_LABELS,
  formatMoney,
  type DealStage,
} from "@/lib/creator-crm/types";
import { exportDealsCsv } from "@/lib/creator-crm/csv";
import { AddDealDrawer } from "./AddDealDrawer";
import { CsvImportDrawer } from "./CsvImportDrawer";

export function PipelinePageContent() {
  const { authenticatedRequest } = useAuth();
  const { data, ready, moveDeal, createDeal, importCsv, error } =
    useCreatorCrm(authenticatedRequest);
  const [draggingDealId, setDraggingDealId] = useState<string | null>(null);
  const [dropTargetStage, setDropTargetStage] = useState<DealStage | null>(
    null,
  );
  const [actionError, setActionError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  if (!ready) return null;

  const handleDrop = async (stage: DealStage, dealId: string) => {
    setActionError("");
    try {
      await moveDeal(dealId, stage);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update deal stage",
      );
    } finally {
      setDraggingDealId(null);
      setDropTargetStage(null);
    }
  };

  return (
    <>
      <header className="app-topbar">
        <h1>Deal Pipeline</h1>
        <div className="crm-topbar-actions">
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() =>
              exportDealsCsv(data.deals, data.brands, data.people)
            }
          >
            Export CSV
          </button>
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => setImportOpen(true)}
          >
            Import CSV
          </button>
          <button
            type="button"
            className="crm-btn-primary"
            onClick={() => setDrawerOpen(true)}
          >
            + Add deal
          </button>
        </div>
      </header>

      <div className="app-content">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}
        <p className="crm-contact-sub" style={{ marginBottom: 16 }}>
          Drag deals between columns to update stage. Moving a deal to{" "}
          <strong>Won</strong> creates a job if one does not already exist.
        </p>
        <div className="crm-pipeline">
          {DEAL_STAGES.map((stage) => {
            const deals = data.deals.filter((d) => d.stage === stage);
            const columnValue = deals.reduce(
              (sum, deal) => sum + deal.valueCents,
              0,
            );
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
                  setDropTargetStage((current) =>
                    current === stage ? null : current,
                  );
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const dealId = e.dataTransfer.getData("text/deal-id");
                  if (dealId) void handleDrop(stage, dealId);
                }}
              >
                <h3>
                  {DEAL_STAGE_LABELS[stage]} ({deals.length})
                </h3>
                <p className="crm-pipeline-column-value">
                  {formatMoney(columnValue)}
                </p>
                {deals.map((deal) => {
                  const brand = data.brands.find((b) => b.id === deal.brandId);
                  return (
                    <div
                      key={deal.id}
                      className={`crm-pipeline-card ${draggingDealId === deal.id ? "crm-pipeline-card--dragging" : ""}`}
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
                      <span>
                        {brand ? (
                          <Link href={CRM_ROUTES.brand(brand.id)}>
                            {brand.name}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </span>
                      <span>{formatMoney(deal.valueCents)}</span>
                      {deal.expectedCloseDate ? (
                        <span>Close {deal.expectedCloseDate}</span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <AddDealDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        brands={data.brands}
        people={data.people}
        onSubmit={async (input) => {
          await createDeal(input);
        }}
      />
      <CsvImportDrawer
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImport={async (payload) => {
          await importCsv(payload);
        }}
      />
    </>
  );
}
