"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorCrm } from "@/lib/creator-crm/storage";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import { RELATIONSHIP_STAGE_LABELS } from "@/lib/creator-crm/types";
import { InviteBrandDrawer } from "./InviteBrandDrawer";

export function BrandsPageContent() {
  const { session, authenticatedRequest } = useAuth();
  const { data, ready } = useCreatorCrm(authenticatedRequest);
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!ready) return null;

  return (
    <>
      <header className="app-topbar">
        <h1>Brands</h1>
        <button type="button" className="crm-btn-primary" onClick={() => setInviteOpen(true)}>
          + Invite brand
        </button>
      </header>

      <div className="app-content">
        <p style={{ color: "var(--muted)", marginTop: 0, marginBottom: 20 }}>
          Manage your brand relationships — Nike, local boutiques, skincare brands, restaurants, and more.
          Invite new brands to join Thesi and optionally add them to your CRM.
        </p>

        <div className="crm-brand-grid">
          {data.brands.map((brand) => (
            <Link key={brand.id} href={CRM_ROUTES.brand(brand.id)} className="crm-brand-card">
              <span className={`crm-status crm-status--${brand.relationshipStage === "partner" ? "client" : brand.relationshipStage === "prospect" ? "lead" : "active"}`}>
                {RELATIONSHIP_STAGE_LABELS[brand.relationshipStage]}
              </span>
              <h3>{brand.name}</h3>
              <p>{brand.contactName} · {brand.email}</p>
              <div className="crm-tags" style={{ marginTop: 12 }}>
                {brand.tags.map((tag) => (
                  <span key={tag} className="crm-tag">{tag}</span>
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
    </>
  );
}
