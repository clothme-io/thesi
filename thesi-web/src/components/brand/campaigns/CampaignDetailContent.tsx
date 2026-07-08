"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { getCampaignById, useBrandCampaigns } from "@/lib/brand-campaigns/storage";
import {
  BRAND_CAMPAIGN_PAYMENT_LABELS,
  BRAND_CAMPAIGN_STATUS_LABELS,
  BRAND_CAMPAIGN_TYPE_LABELS,
  formatMoney,
  getCampaignBudgetLabel,
} from "@/lib/brand-campaigns/types";
import { getInvitesForCampaign, loadInviteData, useInvites } from "@/lib/invites/storage";
import { InviteCreatorDrawer } from "./InviteCreatorDrawer";

export function CampaignDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { session } = useAuth();
  const { data, ready } = useBrandCampaigns();
  const { data: inviteData, ready: invitesReady, persist: persistInvites } = useInvites();
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!ready || !invitesReady) return null;

  const campaign = getCampaignById(data, id);
  if (!campaign) {
    return (
      <div className="app-content">
        <p>
          Campaign not found. <Link href="/app/campaigns">Back to campaigns</Link>
        </p>
      </div>
    );
  }

  const brandName = session?.user.fullName ?? "Your Brand";
  const invites = getInvitesForCampaign(inviteData, campaign.id);

  const refreshInvites = () => {
    persistInvites(loadInviteData());
  };

  return (
    <>
      <header className="app-topbar">
        <div>
          <Link href="/app/campaigns" className="auth-link" style={{ fontSize: 13 }}>
            ← Campaigns
          </Link>
          <h1 style={{ marginTop: 4 }}>{campaign.name}</h1>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button type="button" className="crm-btn-secondary" onClick={() => setInviteOpen(true)}>
            Invite creators
          </button>
          <Link href="/app/campaigns/new" className="crm-btn-secondary">
            Duplicate as new
          </Link>
        </div>
      </header>
      <div className="app-content">
        <div className="crm-detail-grid">
          <div className="crm-detail-panel">
            <h3>Campaign summary</h3>
            <div className="crm-meta-row">
              <span>Type</span>
              <span>{BRAND_CAMPAIGN_TYPE_LABELS[campaign.type]}</span>
            </div>
            <div className="crm-meta-row">
              <span>Status</span>
              <span>{BRAND_CAMPAIGN_STATUS_LABELS[campaign.status]}</span>
            </div>
            <div className="crm-meta-row">
              <span>Timeline</span>
              <span>
                {campaign.startDate} → {campaign.endDate}
              </span>
            </div>
            <div className="crm-meta-row">
              <span>Marketplace</span>
              <span>{campaign.postToMarketplace ? "Posted" : "Private invite only"}</span>
            </div>
            <h3 style={{ marginTop: 24 }}>Brief</h3>
            <p>{campaign.brief}</p>
            <h3 style={{ marginTop: 24 }}>Deliverables</h3>
            <p>{campaign.deliverables}</p>
          </div>

          <div>
            <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
              <h3>Creator criteria</h3>
              <div className="crm-meta-row">
                <span>Niches</span>
                <span>{campaign.requirements.niches.join(", ") || "—"}</span>
              </div>
              <div className="crm-meta-row">
                <span>Min followers</span>
                <span>{campaign.requirements.minFollowersRange || "—"}</span>
              </div>
              <div className="crm-meta-row">
                <span>Location</span>
                <span>{campaign.requirements.location || "—"}</span>
              </div>
              <div className="crm-meta-row">
                <span>Platforms</span>
                <span>{campaign.requirements.platforms.join(", ") || "—"}</span>
              </div>
            </div>

            <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
              <h3>Invites sent</h3>
              {invites.length === 0 ? (
                <p className="workspace-hint">No invites sent yet. Use Invite creators to match and reach out.</p>
              ) : (
                invites.map((invite) => (
                  <div className="crm-meta-row" key={invite.id}>
                    <span>
                      {invite.creatorName}
                      {invite.external && (
                        <span className="crm-tag" style={{ marginLeft: 8 }}>
                          External
                        </span>
                      )}
                    </span>
                    <span>{invite.status}</span>
                  </div>
                ))
              )}
            </div>

            <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
              <h3>Payment</h3>
              <div className="crm-meta-row">
                <span>Model</span>
                <span>{BRAND_CAMPAIGN_PAYMENT_LABELS[campaign.payment.model]}</span>
              </div>
              <div className="crm-meta-row">
                <span>Budget</span>
                <span>{getCampaignBudgetLabel(campaign)}</span>
              </div>
              {campaign.payment.milestones?.map((milestone) => (
                <div className="crm-meta-row" key={milestone.id}>
                  <span>{milestone.label}</span>
                  <span>{formatMoney(milestone.amountCents)}</span>
                </div>
              ))}
              {campaign.payment.notes && (
                <p className="workspace-hint" style={{ marginTop: 10 }}>
                  {campaign.payment.notes}
                </p>
              )}
            </div>

            <div className="crm-detail-panel">
              <h3>Files</h3>
              {campaign.files.length === 0 ? (
                <p className="workspace-hint">No files uploaded.</p>
              ) : (
                campaign.files.map((file) => (
                  <div className="crm-meta-row" key={file.id}>
                    <span>{file.name}</span>
                    <span>{file.sizeLabel}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <InviteCreatorDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        campaignId={campaign.id}
        campaignName={campaign.name}
        brandName={brandName}
        criteria={campaign.requirements}
        onInvited={refreshInvites}
      />
    </>
  );
}
