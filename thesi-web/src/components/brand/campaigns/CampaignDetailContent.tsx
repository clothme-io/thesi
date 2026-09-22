"use client";
import {campaignProducts} from "./CampaignProductSelection";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import {useWorkspacePermissions} from '@/context/WorkspacePermissions';
import { toDateInputValue } from "@/lib/brand-campaigns/date";
import { PromotedProductDetails } from "./PromotedProductDetails";
import { CampaignFundingPanel } from "./CampaignFundingPanel";
import { CommissionPaymentDetails } from "./CommissionPaymentDetails";
import { paymentFormError } from "@/lib/brand-campaigns/payment-form";
import {
  downloadCampaignFile,
  getCampaignById,
  campaignMarketplaceLabel,
  useBrandCampaigns,
  type CampaignInput,
} from "@/lib/brand-campaigns/storage";
import {
  BRAND_CAMPAIGN_GOAL_TYPE_LABELS,
  BRAND_CAMPAIGN_PAYMENT_LABELS,
  BRAND_CAMPAIGN_STATUS_LABELS,
  EMPTY_CONTENT_RIGHTS,
  EMPTY_CREATOR_BENEFITS,
  formatMoney,
  getCampaignBudgetLabel,
  getCampaignContentTypesLabel,
  type BrandCampaign,
  type BrandCampaignStatus,
} from "@/lib/brand-campaigns/types";
import { getInvitesForCampaign, useInvites } from "@/lib/invites/storage";
import { INVITE_STATUS_LABELS } from "@/lib/invites/status-labels";
import {
  DraftCampaignEditForm,
  draftFormToInput,
  useDraftForm,
} from "./DraftCampaignEditForm";
import { InviteCreatorDrawer } from "./InviteCreatorDrawer";
import { CampaignPublishedContent } from "@/components/inbox/CampaignPublishedContent";
import { CampaignContentReview } from "./CampaignContentReview";
import {
  campaignFromRevision,
  type CampaignRevision,
} from "@/lib/brand-campaigns/revisions";

function toCampaignInput(campaign: BrandCampaign): CampaignInput {
  return {
    name: campaign.name,
    campaignType: campaign.campaignType,
    contentTypes: campaign.contentTypes,
    status: campaign.status,
    startDate: toDateInputValue(campaign.startDate),
    endDate: toDateInputValue(campaign.endDate),
    brief: campaign.brief,
    deliverables: campaign.deliverables,
    exampleVideoLinks: campaign.exampleVideoLinks,
    requirements: campaign.requirements,
    files: campaign.files,
    payment: campaign.payment,
    requiredTasks: campaign.requiredTasks ?? [],
    creatorBenefits: campaign.creatorBenefits ?? EMPTY_CREATOR_BENEFITS,
    contentRights: campaign.contentRights ?? EMPTY_CONTENT_RIGHTS,
    productsProvided: campaign.productsProvided ?? [],
    ...(campaign.creatorCapacity ? { creatorCapacity: campaign.creatorCapacity } : {}),
    creatorDisclosureEnabled: campaign.creatorDisclosureEnabled ?? false,
    postToMarketplace: campaign.postToMarketplace,
  };
}

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
  const {canEdit,canManageFunds}=useWorkspacePermissions();
  const { id } = useParams<{ id: string }>();
  const { session, authenticatedRequest, authenticatedBinaryRequest } =
    useAuth();
  const {
    data,
    ready,
    error,
    updateCampaign,
    uploadCampaignFile,
    deleteCampaignFile,
    reload,
  } = useBrandCampaigns(authenticatedRequest);
  const {
    data: inviteData,
    ready: invitesReady,
    reload: reloadInvites,
  } = useInvites(authenticatedRequest);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const [lifecycleError, setLifecycleError] = useState("");
  const [lifecycleBusy, setLifecycleBusy] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [payouts, setPayouts] = useState<CreatorPayout[]>([]);
  const [payoutError, setPayoutError] = useState("");
  const [payingCreatorId, setPayingCreatorId] = useState<string | null>(null);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const [revisions, setRevisions] = useState<CampaignRevision[]>([]);
  const [viewingRevisionId, setViewingRevisionId] = useState<string | null>(null);
  const [restoringRevisionId, setRestoringRevisionId] = useState<string | null>(
    null,
  );

  const campaign = useMemo(
    () => (ready && id ? getCampaignById(data, id) : null),
    [ready, id, data],
  );
  const viewingRevision = useMemo(
    () => revisions.find((revision) => revision.id === viewingRevisionId) ?? null,
    [revisions, viewingRevisionId],
  );
  const displayedCampaign = useMemo(() => {
    if (!campaign) return null;
    if (!viewingRevision || viewingRevision.isCurrent) return campaign;
    return campaignFromRevision(campaign, viewingRevision);
  }, [campaign, viewingRevision]);
  const viewingCurrent = !viewingRevision || viewingRevision.isCurrent;
  const requiredTasks = displayedCampaign?.requiredTasks ?? [];
  const creatorBenefits =
    displayedCampaign?.creatorBenefits ?? EMPTY_CREATOR_BENEFITS;
  const contentRights =
    displayedCampaign?.contentRights ?? EMPTY_CONTENT_RIGHTS;
  const productsProvided = displayedCampaign?.productsProvided ?? [];
  const editableCampaign: BrandCampaign | null =
    campaign && (campaign.status === "draft" || viewingCurrent) ? campaign : null;
  const { form, setForm } = useDraftForm(
    editableCampaign,
    { allowPublished: Boolean(campaign && campaign.status !== "draft" && viewingCurrent) },
  );

  const loadPayouts = useCallback(async () => {
    if (!id||!canManageFunds) return;
    const result = await authenticatedRequest<{ payouts: CreatorPayout[] }>(
      `/api/campaigns/${id}/payouts`,
    );
    setPayouts(result.payouts ?? []);
  }, [authenticatedRequest, id,canManageFunds]);

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

  const loadRevisions = useCallback(async () => {
    if (!id) return;
    const result = await authenticatedRequest<{ revisions: CampaignRevision[] }>(
      `/api/campaigns/${id}/revisions`,
    );
    setRevisions(result.revisions ?? []);
  }, [authenticatedRequest, id]);

  useEffect(() => {
    if (!ready || !id || !campaign || campaign.status === "draft") {
      setRevisions([]);
      setViewingRevisionId(null);
      return;
    }
    let active = true;
    loadRevisions().catch(() => {
      if (active) setRevisions([]);
    });
    return () => {
      active = false;
    };
  }, [ready, id, campaign, loadRevisions]);

  if (!ready || !invitesReady) return null;

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

  const isDraft = campaign.status === "draft";
  const marketplaceLabel = campaignMarketplaceLabel(campaign);
  const brandName = session?.user.fullName ?? "Your Brand";
  const invites = getInvitesForCampaign(inviteData, campaign.id);
  const hasAcceptedCreator = invites.some((invite) => invite.status === "accepted");
  const acceptedCreatorCount = invites.filter(
    (invite) => invite.status === "accepted",
  ).length;
  const editingPublishedCurrent =
    canEdit && !isDraft && viewingCurrent;
  const hasAcceptedPublishedCurrent =
    canEdit && campaign.status === "active" && hasAcceptedCreator && viewingCurrent;
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

  const applyLifecycle = async (patch: {
    status?: BrandCampaignStatus;
    postToMarketplace?: boolean;
  }) => {
    setLifecycleBusy(true);
    setLifecycleError("");
    setSaveMessage("");
    try {
      const base =
        isDraft && form
          ? draftFormToInput(form)
          : toCampaignInput(campaign);
      if (patch.status === "active" && isDraft && form) {
        const milestoneError = paymentFormError(
          form.paymentModel,
          form.milestones,
          form.hybridPayment,
        );
        if (milestoneError) {
          setLifecycleError(milestoneError);
          return;
        }
      }
      await updateCampaign(campaign.id, {
        ...base,
        ...patch,
      });
      setPendingFiles([]);
    } catch (requestError) {
      setLifecycleError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update campaign",
      );
    } finally {
      setLifecycleBusy(false);
    }
  };

  const saveDraft = async () => {
    if (!form) return;
    setSavingDraft(true);
    setLifecycleError("");
    setSaveMessage("");
    try {
      const payload = draftFormToInput(form);
      await updateCampaign(campaign.id, payload);
      let fileUploadFailed = false;
      for (const file of pendingFiles) {
        try {
          await uploadCampaignFile(campaign.id, file);
        } catch {
          fileUploadFailed = true;
        }
      }
      if (!fileUploadFailed) {
        setPendingFiles([]);
      }
      setSaveMessage(
        fileUploadFailed
          ? "Draft saved. Some files could not be uploaded."
          : "Draft saved",
      );
    } catch (requestError) {
      setLifecycleError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save draft",
      );
    } finally {
      setSavingDraft(false);
    }
  };

  const savePublishedUpdates = async () => {
    if (!form) return;
    setSavingDraft(true);
    setLifecycleError("");
    setSaveMessage("");
    try {
      const payload = draftFormToInput(form);
      await updateCampaign(campaign.id, {
        ...payload,
        status: campaign.status,
        postToMarketplace: campaign.postToMarketplace,
      });
      let fileUploadFailed = false;
      for (const file of pendingFiles) {
        try {
          await uploadCampaignFile(campaign.id, file);
        } catch {
          fileUploadFailed = true;
        }
      }
      if (!fileUploadFailed) {
        setPendingFiles([]);
      }
      await loadRevisions();
      setSaveMessage(
        fileUploadFailed
          ? "New version saved. Some files could not be uploaded."
          : acceptedCreatorCount > 0
            ? "New version saved. Accepted creators keep their original terms."
            : "Campaign updates saved",
      );
    } catch (requestError) {
      setLifecycleError(
        requestError instanceof Error
          ? requestError.message
          : "Could not save campaign updates",
      );
    } finally {
      setSavingDraft(false);
    }
  };

  const restoreRevision = async (revisionId: string) => {
    setRestoringRevisionId(revisionId);
    setLifecycleError("");
    setSaveMessage("");
    try {
      await authenticatedRequest(`/api/campaigns/${campaign.id}/revisions/${revisionId}/restore`, {
        method: "POST",
      });
      await reload();
      await loadRevisions();
      setViewingRevisionId(null);
      setSaveMessage(
        "This version is now current for new applicants. Accepted creators keep their original terms.",
      );
    } catch (requestError) {
      setLifecycleError(
        requestError instanceof Error
          ? requestError.message
          : "Could not restore this version",
      );
    } finally {
      setRestoringRevisionId(null);
    }
  };

  const canPublish =
    campaign.status === "draft" ||
    (campaign.status === "active" && !campaign.postToMarketplace);
  const canResume = campaign.status === "paused";
  const canPause = campaign.status === "active" && !hasAcceptedPublishedCurrent;
  const canComplete =
    (campaign.status === "draft" && campaign.payment.hybrid?.affiliate?.fundingFlowVersion === 1) ||
    (campaign.status === "active" && (!hasAcceptedPublishedCurrent || campaign.payment.hybrid?.affiliate?.fundingFlowVersion === 1)) ||
    campaign.status === "paused";
  const canUnpublish =
    campaign.postToMarketplace &&
    campaign.status !== "draft" &&
    !hasAcceptedPublishedCurrent;

  return (
    <>
      <header className="app-topbar">
        <div>
          <Link
            href="/app/campaigns"
            className="auth-link"
            style={{ fontSize: 13 }}
          >
            ← Campaigns
          </Link>
          <h1 style={{ marginTop: 4 }}>
            {isDraft && form ? form.name || campaign.name : campaign.name}
          </h1>
        </div>
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {canEdit && isDraft && (
            <button
              type="button"
              className="crm-btn-primary"
              disabled={savingDraft || lifecycleBusy || !form}
              onClick={() => void saveDraft()}
            >
              {savingDraft ? "Saving…" : "Save draft"}
            </button>
          )}
          {canEdit && editingPublishedCurrent && form && (
            <button
              type="button"
              className="crm-btn-primary"
              disabled={savingDraft || lifecycleBusy}
              onClick={() => void savePublishedUpdates()}
            >
              {savingDraft
                ? "Saving…"
                : acceptedCreatorCount > 0
                  ? "Save as new version"
                  : "Save updates"}
            </button>
          )}
          {canEdit && canPublish && (
            <button
              type="button"
              className="crm-btn-primary"
              disabled={lifecycleBusy || savingDraft}
              onClick={() =>
                void applyLifecycle({
                  status: "active",
                  postToMarketplace: true,
                })
              }
            >
              {campaign.status === "draft" ? "Publish" : "Post to marketplace"}
            </button>
          )}
          {canEdit && canResume && (
            <button
              type="button"
              className="crm-btn-primary"
              disabled={lifecycleBusy}
              onClick={() => void applyLifecycle({ status: "active" })}
            >
              Resume
            </button>
          )}
          {canEdit && canPause && (
            <button
              type="button"
              className="crm-btn-secondary"
              disabled={lifecycleBusy}
              onClick={() => void applyLifecycle({ status: "paused" })}
            >
              Pause
            </button>
          )}
          {canEdit && canComplete && (
            <button
              type="button"
              className="crm-btn-secondary"
              disabled={lifecycleBusy}
              onClick={() => void applyLifecycle({ status: "completed" })}
            >
              Mark complete
            </button>
          )}
          {canEdit && canUnpublish && (
            <button
              type="button"
              className="crm-btn-secondary"
              disabled={lifecycleBusy}
              onClick={() => void applyLifecycle({ postToMarketplace: false })}
            >
              Unpublish
            </button>
          )}
          <button
            type="button"
            className="crm-btn-secondary"
            onClick={() => setInviteOpen(true)}
            disabled={!canEdit}
          >
            Invite creators
          </button>
          {canEdit && <Link
            href={`/app/campaigns/new?from=${campaign.id}`}
            className="crm-btn-secondary"
          >
            Duplicate as new
          </Link>}
        </div>
      </header>
      <div className="app-content">
        {campaign.payment.hybrid?.affiliate?.fundingFlowVersion === 1 && <CampaignFundingPanel campaign={campaign} />}
        {(lifecycleError || error) && (
          <p className="workspace-hint" style={{ marginBottom: 16 }} role="alert">
            {lifecycleError || error}
          </p>
        )}
        {saveMessage && !lifecycleError && (
          <p className="workspace-hint" style={{ marginBottom: 16 }} role="status">
            {saveMessage}
          </p>
        )}

        {!isDraft && revisions.length > 0 && (
          <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
            <div className="crm-meta-row">
              <span>Published versions</span>
              <select
                aria-label="Campaign version"
                value={viewingRevisionId ?? campaign.currentRevisionId ?? revisions.find((row) => row.isCurrent)?.id ?? ""}
                onChange={(event) =>
                  setViewingRevisionId(event.target.value || null)
                }
              >
                {revisions.map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    Version {revision.version}
                    {revision.isCurrent ? " · current" : ""}
                    {` · ${new Date(revision.createdAt).toLocaleDateString()}`}
                  </option>
                ))}
              </select>
            </div>
            {hasAcceptedCreator && viewingCurrent && (
              <p className="workspace-hint" style={{ marginTop: 10, marginBottom: 0 }}>
                Edits apply to new applicants. {acceptedCreatorCount} accepted
                creator{acceptedCreatorCount === 1 ? "" : "s"} keep the version
                they were accepted on.
              </p>
            )}
            {viewingRevision && !viewingRevision.isCurrent && (
              <>
                <p className="workspace-hint" style={{ marginTop: 10 }}>
                  Viewing version {viewingRevision.version}. Creators only see
                  the current version, or the version they were accepted on.
                </p>
                <p className="workspace-hint" style={{ marginTop: 0 }}>
                  Applied: {viewingRevision.appliedCount}
                  {viewingRevision.pendingCount
                    ? ` · ${viewingRevision.pendingCount} pending`
                    : ""}
                  {viewingRevision.acceptedCreators.length
                    ? ` · accepted: ${viewingRevision.acceptedCreators
                        .map((creator) => creator.name)
                        .join(", ")}`
                    : " · no accepted creators on this version"}
                </p>
                {canEdit && (
                  <button
                    type="button"
                    className="crm-btn-secondary"
                    disabled={restoringRevisionId === viewingRevision.id}
                    onClick={() => void restoreRevision(viewingRevision.id)}
                  >
                    {restoringRevisionId === viewingRevision.id
                      ? "Restoring…"
                      : "Use this version for new applicants"}
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {canEdit && isDraft && form ? (
          <div className="crm-detail-grid">
            <DraftCampaignEditForm
              campaign={campaign}
              form={form}
              onChange={setForm}
              pendingFiles={pendingFiles}
              onPendingFiles={setPendingFiles}
              onDeleteFile={(fileId) => deleteCampaignFile(campaign.id, fileId)}
            />
            <div>
              <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
                <h3>Status</h3>
                <div className="crm-meta-row">
                  <span>Status</span>
                  <span>{BRAND_CAMPAIGN_STATUS_LABELS[campaign.status]}</span>
                </div>
                <p className="workspace-hint" style={{ marginTop: 10 }}>
                  Edit fields below, then Save draft. Publish when you&apos;re
                  ready to activate (platform fee may apply).
                </p>
              </div>
              <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
                <h3>Invites sent</h3>
                {invites.length === 0 ? (
                  <p className="workspace-hint">
                    No invites sent yet. Use Invite creators to match and reach
                    out.
                  </p>
                ) : (
                  invites.map((invite) => (
                    <div className="crm-meta-row" key={invite.id}>
                      <span>{invite.creatorName}</span>
                      <span className="crm-tag">
                        {INVITE_STATUS_LABELS[invite.status]}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : canEdit && editingPublishedCurrent && form ? (
          <div className="crm-detail-grid">
            <DraftCampaignEditForm
              campaign={campaign}
              form={form}
              onChange={setForm}
              pendingFiles={pendingFiles}
              onPendingFiles={setPendingFiles}
              onDeleteFile={(fileId) => deleteCampaignFile(campaign.id, fileId)}
            />
            <div>
              <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
                {campaignProducts(campaign.payment).map((product) => (
                  <PromotedProductDetails key={product.productId} product={product} />
                ))}
                <CampaignContentReview campaignId={campaign.id} canSubmit={false} />
                <CampaignPublishedContent campaignId={campaign.id} canAttach={false} />
              </div>
              <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
                <h3>Status</h3>
                <div className="crm-meta-row">
                  <span>Status</span>
                  <span>{BRAND_CAMPAIGN_STATUS_LABELS[campaign.status]}</span>
                </div>
                {hasAcceptedCreator ? (
                  <p className="workspace-hint" style={{ marginTop: 10 }}>
                    Saving creates a new published version. Accepted creators
                    keep the terms from the date you accepted them.
                  </p>
                ) : (
                  <p className="workspace-hint" style={{ marginTop: 10 }}>
                    Saving updates the live campaign. Pending applicants are
                    notified when terms change.
                  </p>
                )}
              </div>
              <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
                <h3>Invites sent</h3>
                {payoutError && (
                  <p className="workspace-hint" style={{ marginBottom: 10 }}>
                    {payoutError}
                  </p>
                )}
                {invites.length === 0 ? (
                  <p className="workspace-hint">
                    No invites sent yet. Use Invite creators to match and reach
                    out.
                  </p>
                ) : (
                  invites.map((invite) => {
                    const payout = invite.creatorId
                      ? payoutByCreator.get(invite.creatorId)
                      : undefined;
                    const canPay =
                      canManageFunds && Boolean(invite.creatorId) &&
                      !invite.external &&
                      invite.status === "accepted" &&
                      payout?.status !== "transferred";
                    return (
                      <div className="crm-meta-row" key={invite.id}>
                        <span>
                          {invite.creatorName}
                          {invite.external && (
                            <span
                              className="crm-tag"
                              style={{ marginLeft: 8 }}
                            >
                              External
                            </span>
                          )}
                          {payout && (
                            <span
                              className="crm-tag"
                              style={{ marginLeft: 8 }}
                            >
                              {PAYOUT_STATUS_LABELS[payout.status]}
                              {payout.status === "transferred"
                                ? ` · ${formatMoney(payout.amountCents)}`
                                : ""}
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <span className="crm-tag">
                            {INVITE_STATUS_LABELS[invite.status]}
                          </span>
                          {canPay && invite.creatorId && (
                            <button
                              type="button"
                              className="inbox-btn-text"
                              disabled={campaign.payment.model === "commission" || payingCreatorId === invite.creatorId}
                              onClick={() => void payCreator(invite.creatorId!)}
                            >
                              {campaign.payment.model === "commission"
                                ? "Commission payouts coming soon"
                                : payingCreatorId === invite.creatorId
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
            </div>
          </div>
        ) : (
          <div className="crm-detail-grid">
            <div className="crm-detail-panel">
              {campaignProducts((displayedCampaign ?? campaign).payment).map(p=><PromotedProductDetails key={p.productId} product={p}/>)}
              <CampaignContentReview campaignId={campaign.id} canSubmit={false} />
              <CampaignPublishedContent campaignId={campaign.id} canAttach={false} />
              <h3>
                Campaign summary{" "}
                {!viewingCurrent && (
                  <span className="crm-tag" style={{ marginLeft: 8 }}>
                    Version {viewingRevision?.version}
                  </span>
                )}
              </h3>
              <div className="crm-meta-row">
                <span>Campaign type</span>
                <span>
                  {BRAND_CAMPAIGN_GOAL_TYPE_LABELS[(displayedCampaign ?? campaign).campaignType] ??
                    (displayedCampaign ?? campaign).campaignType}
                </span>
              </div>
              <div className="crm-meta-row">
                <span>Content types</span>
                <span>{getCampaignContentTypesLabel((displayedCampaign ?? campaign).contentTypes)}</span>
              </div>
              <div className="crm-meta-row">
                <span>Status</span>
                <span>{BRAND_CAMPAIGN_STATUS_LABELS[campaign.status]}</span>
              </div>
              <div className="crm-meta-row">
                <span>Timeline</span>
                <span>
                  {toDateInputValue((displayedCampaign ?? campaign).startDate)} →{" "}
                  {toDateInputValue((displayedCampaign ?? campaign).endDate)}
                </span>
              </div>
              <div className="crm-meta-row">
                <span>Marketplace</span>
                <span>
                  {marketplaceLabel === "Private"
                    ? "Private invite only"
                    : marketplaceLabel === "When published"
                      ? "Will post when published"
                      : marketplaceLabel}
                </span>
              </div>
              <h3 style={{ marginTop: 24 }}>Brief</h3>
              <p>{(displayedCampaign ?? campaign).brief}</p>
              <h3 style={{ marginTop: 24 }}>Deliverables</h3>
              <p>{(displayedCampaign ?? campaign).deliverables}</p>
              {requiredTasks.length > 0 && (
                <>
                  <h3 style={{ marginTop: 24 }}>Required tasks</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {requiredTasks.map((task) => (
                      <li key={task.id}>
                        {task.title}
                        {task.description ? ` — ${task.description}` : ""}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {(creatorBenefits.guaranteedPaymentCents ||
                productsProvided.length > 0 ||
                creatorBenefits.productsKept ||
                creatorBenefits.bonusEligibility ||
                creatorBenefits.creatorPoolEligibility ||
                creatorBenefits.foundingCreatorRecognition ||
                creatorBenefits.portfolioUse ||
                creatorBenefits.priorityFutureCampaigns ||
                creatorBenefits.brandOpportunityAccess ||
                creatorBenefits.customBenefits.length > 0) && (
                <>
                  <h3 style={{ marginTop: 24 }}>Creator benefits</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {creatorBenefits.guaranteedPaymentCents ? (
                      <li>
                        {formatMoney(creatorBenefits.guaranteedPaymentCents)} guaranteed campaign payment
                      </li>
                    ) : null}
                    {productsProvided.map((product) => (
                      <li key={product.id}>
                        {product.name}
                        {product.creatorKeeps ? " — yours to keep" : ""}
                      </li>
                    ))}
                    {creatorBenefits.foundingCreatorRecognition && (
                      <li>Founding Creator campaign participation</li>
                    )}
                    {creatorBenefits.portfolioUse && (
                      <li>Portfolio-ready UGC experience</li>
                    )}
                    {creatorBenefits.priorityFutureCampaigns && (
                      <li>Priority consideration for upcoming campaigns</li>
                    )}
                    {creatorBenefits.creatorPoolEligibility && (
                      <li>Eligibility for future Creator Pool campaigns</li>
                    )}
                    {creatorBenefits.bonusEligibility && (
                      <li>Performance bonus eligibility</li>
                    )}
                    {creatorBenefits.brandOpportunityAccess && (
                      <li>Future brand and boutique opportunities</li>
                    )}
                    {creatorBenefits.customBenefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                </>
              )}
              {(contentRights.organicUsage ||
                contentRights.websiteAppUsage ||
                contentRights.paidAdsUsage ||
                contentRights.rawContentAccess ||
                contentRights.duration.trim()) && (
                <>
                  <h3 style={{ marginTop: 24 }}>Content rights</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {contentRights.organicUsage && <li>Organic social usage</li>}
                    {contentRights.websiteAppUsage && <li>Website and app usage</li>}
                    {contentRights.paidAdsUsage && <li>Paid ads usage</li>}
                    {contentRights.rawContentAccess && <li>Raw content access</li>}
                    {contentRights.duration.trim() && (
                      <li>Duration: {contentRights.duration}</li>
                    )}
                  </ul>
                </>
              )}
              {((displayedCampaign ?? campaign).exampleVideoLinks?.length ?? 0) > 0 && (
                <>
                  <h3 style={{ marginTop: 24 }}>Example videos</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {(displayedCampaign ?? campaign).exampleVideoLinks.map((link) => (
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
                  <span>
                    {campaign.requirements.minFollowersRange || "—"}
                  </span>
                </div>
                <div className="crm-meta-row">
                  <span>Location</span>
                  <span>{campaign.requirements.location || "—"}</span>
                </div>
                <div className="crm-meta-row">
                  <span>Platforms</span>
                  <span>
                    {campaign.requirements.platforms.join(", ") || "—"}
                  </span>
                </div>
                <div className="crm-meta-row">
                  <span>Creator capacity</span>
                  <span>{(displayedCampaign ?? campaign).creatorCapacity ?? "—"}</span>
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
                  <p className="workspace-hint">
                    No invites sent yet. Use Invite creators to match and reach
                    out.
                  </p>
                ) : (
                  invites.map((invite) => {
                    const payout = invite.creatorId
                      ? payoutByCreator.get(invite.creatorId)
                      : undefined;
                    const canPay =
                      canManageFunds && Boolean(invite.creatorId) &&
                      !invite.external &&
                      invite.status === "accepted" &&
                      payout?.status !== "transferred";
                    return (
                      <div className="crm-meta-row" key={invite.id}>
                        <span>
                          {invite.creatorName}
                          {invite.external && (
                            <span
                              className="crm-tag"
                              style={{ marginLeft: 8 }}
                            >
                              External
                            </span>
                          )}
                          {payout && (
                            <span
                              className="crm-tag"
                              style={{ marginLeft: 8 }}
                            >
                              {PAYOUT_STATUS_LABELS[payout.status]}
                              {payout.status === "transferred"
                                ? ` · ${formatMoney(payout.amountCents)}`
                                : ""}
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            display: "flex",
                            gap: 8,
                            alignItems: "center",
                          }}
                        >
                          <span className="crm-tag">
                            {INVITE_STATUS_LABELS[invite.status]}
                          </span>
                          {canPay && invite.creatorId && (
                            <button
                              type="button"
                              className="inbox-btn-text"
                              disabled={campaign.payment.model === "commission" || payingCreatorId === invite.creatorId}
                              onClick={() => void payCreator(invite.creatorId!)}
                            >
                              {campaign.payment.model === "commission"
                                ? "Commission payouts coming soon"
                                : payingCreatorId === invite.creatorId
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
                  <span>
                    {BRAND_CAMPAIGN_PAYMENT_LABELS[(displayedCampaign ?? campaign).payment.model]}
                  </span>
                </div>
                <div className="crm-meta-row">
                  <span>Budget</span>
                  <span>{getCampaignBudgetLabel(displayedCampaign ?? campaign)}</span>
                </div>
                {(displayedCampaign ?? campaign).payment.model === "commission" && (
                  <CommissionPaymentDetails payment={(displayedCampaign ?? campaign).payment.hybrid} />
                )}
                {(displayedCampaign ?? campaign).payment.milestones?.map((milestone) => (
                  <div className="crm-meta-row" key={milestone.id}>
                    <span>{milestone.label}</span>
                    <span>
                      {formatMoney(milestone.amountCents)}
                      {milestone.trigger ? ` · ${milestone.trigger}` : ""}
                    </span>
                  </div>
                ))}
                {(displayedCampaign ?? campaign).payment.notes && (
                  <p className="workspace-hint" style={{ marginTop: 10 }}>
                    {(displayedCampaign ?? campaign).payment.notes}
                  </p>
                )}
              </div>

              <div className="crm-detail-panel">
                <h3>Files</h3>
                {downloadError && (
                  <p className="workspace-hint">{downloadError}</p>
                )}
                {(displayedCampaign ?? campaign).files.length === 0 ? (
                  <p className="workspace-hint">No files uploaded.</p>
                ) : (
                  (displayedCampaign ?? campaign).files.map((file) => (
                    <div className="crm-meta-row" key={file.id}>
                      <span>
                        {file.name}
                        <span
                          className="workspace-hint"
                          style={{ marginLeft: 8 }}
                        >
                          {file.sizeLabel}
                        </span>
                      </span>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
                        {canEdit && viewingCurrent && (
                          <button
                            type="button"
                            className="inbox-btn-text"
                            disabled={deletingFileId === file.id}
                            onClick={async () => {
                              setDownloadError("");
                              setDeletingFileId(file.id);
                              try {
                                await deleteCampaignFile(campaign.id, file.id);
                              } catch (requestError) {
                                setDownloadError(
                                  requestError instanceof Error
                                    ? requestError.message
                                    : "Could not remove file",
                                );
                              } finally {
                                setDeletingFileId(null);
                              }
                            }}
                          >
                            {deletingFileId === file.id ? "Removing..." : "Remove"}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <InviteCreatorDrawer
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        campaignId={campaign.id}
        campaignName={
          isDraft && form ? form.name || campaign.name : campaign.name
        }
        brandName={brandName}
        criteria={
          isDraft && form
            ? {
                niches: form.niches
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
                minFollowersRange: form.minFollowersRange,
                location: form.location,
                platforms: form.platforms,
              }
            : campaign.requirements
        }
        onInvited={refreshInvites}
      />
    </>
  );
}
