"use client";

import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import Link from "next/link";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import { CONTRACT_STATUSES, CONTRACT_STATUS_LABELS } from "@/lib/creator-crm/types";
import { UploadContractDrawer } from "./UploadContractDrawer";

export function ContractsPageContent() {
  const { authenticatedRequest } = useAuth();
  const { data, ready, createContract, error } =
    useCreatorCrm(authenticatedRequest);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionError, setActionError] = useState("");

  if (!ready) return null;

  return (
    <>
      <header className="app-topbar">
        <h1>Contracts</h1>
        <button
          type="button"
          className="crm-btn-primary"
          onClick={() => setDrawerOpen(true)}
        >
          + Upload contract
        </button>
      </header>

      <div className="app-content">
        {(error || actionError) && (
          <p className="workspace-hint" style={{ marginBottom: 12 }}>
            {actionError || error}
          </p>
        )}
        <div className="crm-pipeline crm-pipeline--contracts">
          {CONTRACT_STATUSES.map((status) => {
            const contracts = data.contracts.filter((c) => c.status === status);
            return (
              <div key={status} className="crm-pipeline-column">
                <h3>
                  {CONTRACT_STATUS_LABELS[status]} ({contracts.length})
                </h3>
                {contracts.length === 0 ? (
                  <p className="crm-pipeline-empty">None</p>
                ) : (
                  contracts.map((contract) => {
                    const brand = data.brands.find(
                      (b) => b.id === contract.brandId,
                    );
                    const job = contract.jobId
                      ? data.jobs.find((j) => j.id === contract.jobId)
                      : undefined;
                    return (
                      <div key={contract.id} className="crm-pipeline-card">
                        <strong>{contract.title}</strong>
                        <span>
                          {brand ? (
                            <Link href={CRM_ROUTES.brand(brand.id)}>
                              {brand.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </span>
                        <span>{contract.fileName || "No file attached"}</span>
                        {contract.signedAt && (
                          <span>Signed {contract.signedAt}</span>
                        )}
                        {contract.expiresAt && (
                          <span>Expires {contract.expiresAt}</span>
                        )}
                        {job && (
                          <Link
                            href={CRM_ROUTES.job(job.id)}
                            className="auth-link"
                            style={{ fontSize: 12 }}
                          >
                            View job →
                          </Link>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
        <p className="crm-contact-sub" style={{ marginTop: 16 }}>
          E-signature integration coming later.
        </p>
      </div>

      <UploadContractDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        brands={data.brands}
        jobs={data.jobs}
        onSubmit={async (input) => {
          setActionError("");
          try {
            await createContract(input);
          } catch (requestError) {
            setActionError(
              requestError instanceof Error
                ? requestError.message
                : "Could not upload contract",
            );
            throw requestError;
          }
        }}
      />
    </>
  );
}
