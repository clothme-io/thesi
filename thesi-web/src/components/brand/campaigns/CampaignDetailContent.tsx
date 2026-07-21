"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { downloadCampaignFile, getCampaignById, useBrandCampaigns } from "@/lib/brand-campaigns/storage";
import {
  BRAND_CAMPAIGN_GOAL_TYPE_LABELS,
  BRAND_CAMPAIGN_PAYMENT_LABELS,
  BRAND_CAMPAIGN_STATUS_LABELS,
  BRAND_CAMPAIGN_TYPE_LABELS,
  formatMoney,
  getCampaignBudgetLabel,
} from "@/lib/brand-campaigns/types";
import { getInvitesForCampaign, useInvites } from "@/lib/invites/storage";
import { InviteCreatorDrawer } from "./InviteCreatorDrawer";

type CreatorPayout = {
  id: string;
  creatorUserId: string;
  amountCents: number;
  status: "pending" | "charged" | "transferred" | "failed";
  stripeTransferId?: string;
  failureReason?: string;
};

const PAYOUT_STATUS_LABELS: Record<CreatorPayout["status"], string> = {
  pending: "Pending",
  charged: "Charged",
  transferred: "Paid",
  failed: "Failed",
};

export function CampaignDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { session, authenticatedRequest, authenticatedBinaryRequest } = useAuth();
  const { data, ready, error } = useBrandCampaigns(authenticatedRequest);
  const { data: inviteData, ready: invitesReady, reload: reloadInvites } =
    useInvites(authenticatedRequest);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [payouts, setPayouts] = useState<CreatorPayout[]>([]);
  const [payoutError, setPayoutError] = useState("");
  const [payingCreatorId, setPayingCreatorId] = useState<string | null>(null);

  const loadPayouts = useCallback(async () => {
    if (!id) return;
    const result = await authenticatedRequest<{ payouts: CreatorPayout[] }>(
      `/api/campaigns/${id}/payouts`,
    );
    setPayouts(result.payouts ?? []);
  }, [authenticatedRequest, id]);

  useEffect(() => {
    if (!ready || !id) return;
    let active = true;
    loadPayouts().catch((requestError) => {
      if (active) {
        setPayoutError(
          requestError instanceof Error
            ? requestError.message
            : "Could not load creator payouts",
        );
      }
    });
    return () => {
      active = false;
    };
  }, [ready, id, loadPayouts]);

  if (!ready || !invitesReady) return null;

  const campaign = getCampaignById(data, id);
  if (!campaign) {
    return (
      <div className="app-content">
        <p>
          {error || "Campaign not found."}{" "}
          <Link href="/app/campaigns">Back to campaigns</Link>
        </p>
      </div>
    );
  }

  const brandName = session?.user.fullName ?? "Your Brand";
  const invites = getInvitesForCampaign(inviteData, campaign.id);
  const payoutByCreator = new Map(
    payouts.map((payout) => [payout.creatorUserId, payout]),
  );

  const refreshInvites = () => {
    void reloadInvites(campaign.id);
  };

  const payCreator = async (creatorUserId: string) => {
    setPayingCreatorId(creatorUserId);
    setPayoutError("");
    try {
      await authenticatedRequest(`/api/campaigns/${campaign.id}/pay-creator`, {
        method: "POST",
        body: { creatorUserId },
      });
      await loadPayouts();
    } catch (requestError) {
      setPayoutError(
        requestError instanceof Error
          ? requestError.message
          : "Could not pay creator",
      );
    } finally {
      setPayingCreatorId(null);
    }
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
              <span>Campaign type</span>
              <span>
                {BRAND_CAMPAIGN_GOAL_TYPE_LABELS[campaign.campaignType] ??
                  campaign.campaignType}
              </span>
            </div>
            <div className="crm-meta-row">
              <span>Content type</span>
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
            {(campaign.exampleVideoLinks?.length ?? 0) > 0 && (
              <>
                <h3 style={{ marginTop: 24 }}>Example videos</h3>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {campaign.exampleVideoLinks.map((link) => (
                    <li key={link}>
                      <a href={link} target="_blank" rel="noreferrer">
                        {link}
                      </a>
                    </li>
                  ))}
                </ul>
              </>
            )}
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
              {payoutError && (
                <p className="workspace-hint" style={{ marginBottom: 10 }}>
                  {payoutError}
                </p>
              )}
              {invites.length === 0 ? (
                <p className="workspace-hint">No invites sent yet. Use Invite creators to match and reach out.</p>
              ) : (
                invites.map((invite) => {
                  const payout = invite.creatorId
                    ? payoutByCreator.get(invite.creatorId)
                    : undefined;
                  const canPay =
                    Boolean(invite.creatorId) &&
                    !invite.external &&
                    payout?.status !== "transferred";
                  return (
                    <div className="crm-meta-row" key={invite.id}>
                      <span>
                        {invite.creatorName}
                        {invite.external && (
                          <span className="crm-tag" style={{ marginLeft: 8 }}>
                            External
                          </span>
                        )}
                        {payout && (
                          <span className="crm-tag" style={{ marginLeft: 8 }}>
                            {PAYOUT_STATUS_LABELS[payout.status]}
                            {payout.status === "transferred"
                              ? ` · ${formatMoney(payout.amountCents)}`
                              : ""}
                          </span>
                        )}
                      </span>
                      <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        <span>{invite.status}</span>
                        {canPay && invite.creatorId && (
                          <button
                            type="button"
                            className="inbox-btn-text"
                            disabled={payingCreatorId === invite.creatorId}
                            onClick={() => void payCreator(invite.creatorId!)}
                          >
                            {payingCreatorId === invite.creatorId
                              ? "Paying…"
                              : "Pay creator"}
                          </button>
                        )}
                      </span>
                    </div>
                  );
                })
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
              {downloadError && <p className="workspace-hint">{downloadError}</p>}
              {campaign.files.length === 0 ? (
                <p className="workspace-hint">No files uploaded.</p>
              ) : (
                campaign.files.map((file) => (
                  <div className="crm-meta-row" key={file.id}>
                    <span>
                      {file.name}
                      <span className="workspace-hint" style={{ marginLeft: 8 }}>
                        {file.sizeLabel}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="inbox-btn-text"
                      onClick={async () => {
                        setDownloadError("");
                        try {
                          await downloadCampaignFile(
                            authenticatedBinaryRequest,
                            campaign.id,
                            file,
                          );
                        } catch (requestError) {
                          setDownloadError(
                            requestError instanceof Error
                              ? requestError.message
                              : "Could not download file",
                          );
                        }
                      }}
                    >
                      Download
                    </button>
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
