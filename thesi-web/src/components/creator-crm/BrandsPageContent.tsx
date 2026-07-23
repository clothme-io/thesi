"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import {
  RELATIONSHIP_STAGE_LABELS,
  type RelationshipStage,
} from "@/lib/creator-crm/types";
import { exportBrandsCsv } from "@/lib/creator-crm/csv";
import { useSavedViews } from "@/lib/creator-crm/saved-views";
import { InviteBrandDrawer } from "./InviteBrandDrawer";
import { CsvImportDrawer } from "./CsvImportDrawer";

const STAGES: Array<RelationshipStage | ""> = [
  "",
  "prospect",
  "active",
  "partner",
  "inactive",
];

export function BrandsPageContent() {
  const { session, authenticatedRequest } = useAuth();
  const { data, ready, importCsv } = useCreatorCrm(authenticatedRequest);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [stage, setStage] = useState("");
  const [query, setQuery] = useState("");
  const [viewName, setViewName] = useState("");
  const { views, saveView, deleteView } = useSavedViews(
    "brands",
    session?.user.id,
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.brands.filter((brand) => {
      if (stage && brand.relationshipStage !== stage) return false;
      if (!q) return true;
      return (
        brand.name.toLowerCase().includes(q) ||
        brand.contactName.toLowerCase().includes(q) ||
        brand.email.toLowerCase().includes(q) ||
        brand.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [data.brands, stage, query]);

  if (!ready) return null;

  return (
    <>
      <header className="app-topbar">
        <h1>Brands</h1>
        <div className="crm-topbar-actions">
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => exportBrandsCsv(filtered)}
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
            onClick={() => setInviteOpen(true)}
          >
            + Invite brand
          </button>
        </div>
      </header>

      <div className="app-content">
        <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 20 }}>
          Manage your brand relationships. Invite brands to Thesi or import from
          CSV.
        </p>

        <div className="crm-filters">
          <label className="crm-form-field">
            <span>Search</span>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Name, contact, tag…"
            />
          </label>
          <label className="crm-form-field">
            <span>Stage</span>
            <select value={stage} onChange={(e) => setStage(e.target.value)}>
              {STAGES.map((value) => (
                <option key={value || "all"} value={value}>
                  {value
                    ? RELATIONSHIP_STAGE_LABELS[value as RelationshipStage]
                    : "All stages"}
                </option>
              ))}
            </select>
          </label>
          <label className="crm-form-field">
            <span>Save view</span>
            <div className="crm-save-view-row">
              <input
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                placeholder="Active partners"
              />
              <button
                type="button"
                className="crm-btn-secondary"
                onClick={() => {
                  saveView(viewName, { stage, query });
                  setViewName("");
                }}
              >
                Save
              </button>
            </div>
          </label>
        </div>

        {views.length > 0 ? (
          <div className="crm-saved-views">
            {views.map((view) => (
              <span key={view.id} className="crm-saved-view">
                <button
                  type="button"
                  className="crm-saved-view-apply"
                  onClick={() => {
                    setStage(view.filters.stage || "");
                    setQuery(view.filters.query || "");
                  }}
                >
                  {view.name}
                </button>
                <button
                  type="button"
                  className="crm-saved-view-remove"
                  aria-label={`Remove ${view.name}`}
                  onClick={() => deleteView(view.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="crm-brand-grid">
          {filtered.map((brand) => (
            <Link
              key={brand.id}
              href={CRM_ROUTES.brand(brand.id)}
              className="crm-brand-card"
            >
              <span
                className={`crm-status crm-status--${
                  brand.relationshipStage === "partner"
                    ? "client"
                    : brand.relationshipStage === "prospect"
                      ? "lead"
                      : "active"
                }`}
              >
                {RELATIONSHIP_STAGE_LABELS[brand.relationshipStage]}
              </span>
              <h3>{brand.name}</h3>
              <p>
                {brand.contactName} · {brand.email}
              </p>
              <div className="crm-tags" style={{ marginTop: 12 }}>
                {brand.tags.map((tag) => (
                  <span key={tag} className="crm-tag">
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <InviteBrandDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        invitedBy={session?.user.fullName ?? "Creator"}
        invitedByEmail={session?.user.email ?? ""}
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
