"use client";

import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CONTRACT_STATUS_LABELS } from "@/lib/creator-crm/types";

export function ContractsPageContent() {
  const { data, ready } = useCreatorCrm();
  if (!ready) return null;

  const grouped = {
    draft: data.contracts.filter((c) => c.status === "draft"),
    sent: data.contracts.filter((c) => c.status === "sent"),
    signed: data.contracts.filter((c) => c.status === "signed"),
    expired: data.contracts.filter((c) => c.status === "expired"),
  };

  return (
    <>
      <header className="app-topbar">
        <h1>Contracts</h1>
        <button type="button" className="crm-btn-primary">+ Upload contract</button>
      </header>

      <div className="app-content">
        {(["draft", "sent", "signed", "expired"] as const).map((status) => (
          <section key={status} style={{ marginBottom: 24 }}>
            <h2 className="crm-section-title">{CONTRACT_STATUS_LABELS[status]}</h2>
            <div className="crm-dashboard-list">
              {grouped[status].length === 0 ? (
                <p className="crm-contact-sub">None</p>
              ) : (
                grouped[status].map((contract) => {
                  const brand = data.brands.find((b) => b.id === contract.brandId);
                  return (
                    <div key={contract.id} className="crm-list-card">
                      <h3>{contract.title}</h3>
                      <p className="crm-contact-sub">{brand?.name}</p>
                      <p>{contract.fileName || "No file attached"}</p>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        ))}
        <p className="crm-contact-sub">E-signature integration coming later.</p>
      </div>
    </>
  );
}
