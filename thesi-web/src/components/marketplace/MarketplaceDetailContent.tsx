"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { InviteCreatorDrawer } from "@/components/brand/campaigns/InviteCreatorDrawer";
import {
  useMarketplace,
  getListingById,
  hasApplied,
  isInCrm,
  fetchListingApplications,
  respondToListingApplication,
} from "@/lib/marketplace/storage";
import {
  canCreatorApplyToListing,
  getEffectiveListingStatus,
} from "@/lib/marketplace/listings";
import { listingInviteCampaignId, listingToInviteCriteria } from "@/lib/marketplace/invite-criteria";
import { requirementRowsFromListing } from "@/lib/marketplace/requirements";
import { MARKETPLACE_ROUTES } from "@/lib/marketplace/routes";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import { getInvitesForCampaign, useInvites } from "@/lib/invites/storage";
import { INVITE_STATUS_LABELS } from "@/lib/invites/status-labels";
import { BRAND_CAMPAIGN_GOAL_TYPE_LABELS } from "@/lib/brand-campaigns/types";
import {
  PAYMENT_STRUCTURE_LABELS,
  LISTING_STATUS_LABELS,
  APPLICATION_STATUS_LABELS,
  EMPTY_LISTING_CONTENT_RIGHTS,
  formatListingPayment,
  formatListingContentTypes,
  type MarketplaceBrandApplication,
} from "@/lib/marketplace/types";

export function MarketplaceDetailContent() {
  const params = useParams();
  const listingId = params.id as string;
  const { session, authenticatedRequest } = useAuth();
  const isBrand = session?.user.role === "brand";
  const { data, ready, error, applyToListing, linkListingToCrm } =
    useMarketplace(authenticatedRequest);
  const { data: inviteData, ready: invitesReady, reload: reloadInvites } =
    useInvites(authenticatedRequest);
  const [showApply, setShowApply] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [pitch, setPitch] = useState("");
  const [addToCrmOnApply, setAddToCrmOnApply] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [applicants, setApplicants] = useState<MarketplaceBrandApplication[]>([]);
  const [applicantsReady, setApplicantsReady] = useState(!isBrand);
  const [applicantsError, setApplicantsError] = useState("");
  const [respondingApplicationId, setRespondingApplicationId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!isBrand || !listingId) {
      setApplicants([]);
      setApplicantsReady(true);
      return;
    }
    let active = true;
    setApplicantsReady(false);
    setApplicantsError("");
    fetchListingApplications(authenticatedRequest, listingId)
      .then((next) => {
        if (active) setApplicants(next);
      })
      .catch((requestError) => {
        if (active) {
          setApplicants([]);
          setApplicantsError(
            requestError instanceof Error
              ? requestError.message
              : "Could not load applicants",
          );
        }
      })
      .finally(() => {
        if (active) setApplicantsReady(true);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest, isBrand, listingId, data.listings]);

  if (!ready || (isBrand && !invitesReady) || (isBrand && !applicantsReady)) {
    return null;
  }

  const listing = getListingById(data, listingId);
  if (!listing) {
    return (
      <div className="app-content">
        <p>
          {error || "Listing not found."}{" "}
          <Link href={MARKETPLACE_ROUTES.list}>Back to marketplace</Link>
        </p>
      </div>
    );
  }

  const applied = hasApplied(data, listing.id);
  const inCrm = isInCrm(data, listing.id);
  const effectiveStatus = getEffectiveListingStatus(listing);
  const canApply = canCreatorApplyToListing(listing);
  const brandName = session?.user.fullName ?? listing.brandName;
  const inviteCampaignId = listingInviteCampaignId(listing);
  const invites = isBrand ? getInvitesForCampaign(inviteData, inviteCampaignId) : [];
  const requirementRows = requirementRowsFromListing(listing);
  const paymentSummary = formatListingPayment(listing.payment);
  const contentTypesSummary = formatListingContentTypes(listing.contentTypes);
  const contentRights = listing.contentRights ?? EMPTY_LISTING_CONTENT_RIGHTS;

  const refreshInvites = () => {
    void reloadInvites(inviteCampaignId);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canApply) {
      setActionError("Applications are closed for this listing.");
      setShowApply(false);
      return;
    }
    if (!pitch.trim()) return;
    setSubmitting(true);
    setActionError("");
    try {
      await applyToListing(listing, pitch.trim(), addToCrmOnApply);
      setShowApply(false);
      setPitch("");
      showToast(
        addToCrmOnApply
          ? "Application submitted and added to CRM pipeline."
          : "Application submitted.",
      );
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not submit application",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddToCrm = async () => {
    setActionError("");
    try {
      await linkListingToCrm(listing);
      showToast("Added to CRM — new lead in pipeline.");
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not add to CRM",
      );
    }
  };

  const handleRespond = async (
    applicationId: string,
    decision: "accepted" | "rejected",
  ) => {
    setRespondingApplicationId(applicationId);
    setActionError("");
    try {
      const updated = await respondToListingApplication(
        authenticatedRequest,
        listing.id,
        applicationId,
        decision,
      );
      setApplicants((prev) =>
        prev.map((application) =>
          application.id === applicationId
            ? { ...application, status: updated.status }
            : application,
        ),
      );
      showToast(
        decision === "accepted" ? "Application accepted." : "Application rejected.",
      );
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : "Could not update application",
      );
    } finally {
      setRespondingApplicationId(null);
    }
  };

  return (
    <>
      <header className="app-topbar">
        <div>
          <Link href={MARKETPLACE_ROUTES.list} className="auth-link" style={{ fontSize: 13 }}>
            ← Marketplace
          </Link>
          <h1 style={{ marginTop: 4 }}>{listing.name}</h1>
          <span className="workspace-subtitle">
            {listing.brandName} ·{" "}
            {BRAND_CAMPAIGN_GOAL_TYPE_LABELS[listing.campaignType] ??
              listing.campaignType}{" "}
            · {contentTypesSummary}
          </span>
        </div>
        <div className="marketplace-detail-actions">
          {isBrand ? (
            <button type="button" className="crm-btn-primary" onClick={() => setInviteOpen(true)}>
              Invite creators
            </button>
          ) : (
            <>
              {inCrm ? (
                <Link href={CRM_ROUTES.pipeline} className="crm-btn-secondary">
                  View in pipeline
                </Link>
              ) : (
                <button type="button" className="crm-btn-secondary" onClick={handleAddToCrm}>
                  Add to CRM
                </button>
              )}
              {applied ? (
                <span className="marketplace-badge marketplace-badge--applied">
                  {
                    APPLICATION_STATUS_LABELS[
                      data.applications.find((a) => a.listingId === listing.id)?.status ??
                        "pending"
                    ]
                  }
                </span>
              ) : !canApply ? (
                <span className="marketplace-status marketplace-status--closed">
                  Applications closed
                </span>
              ) : (
                <button type="button" className="crm-btn-primary" onClick={() => setShowApply(true)}>
                  Apply
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {toast && <div className="marketplace-toast">{toast}</div>}

      <div className="app-content">
        {(error || actionError) && (
          <p className="workspace-hint">{actionError || error}</p>
        )}
        <div className="marketplace-detail-grid">
          <div className="marketplace-detail-main">
            <section className="marketplace-panel">
              <div className="marketplace-detail-badges">
                <span className={`marketplace-status marketplace-status--${effectiveStatus}`}>
                  {LISTING_STATUS_LABELS[effectiveStatus]}
                </span>
                <span className="marketplace-tag">
                  {BRAND_CAMPAIGN_GOAL_TYPE_LABELS[listing.campaignType] ??
                    listing.campaignType}
                </span>
                <span className="marketplace-tag">
                  {contentTypesSummary}
                </span>
              </div>

              <div className="marketplace-pay-callout">
                <div>
                  <span className="marketplace-pay-callout-label">Creator payout</span>
                  <strong className="marketplace-pay-callout-value">
                    {paymentSummary}
                  </strong>
                  <p className="workspace-hint" style={{ margin: "4px 0 0" }}>
                    {PAYMENT_STRUCTURE_LABELS[listing.payment.structure]}
                    {listing.payment.notes ? ` · ${listing.payment.notes}` : ""}
                  </p>
                </div>
              </div>

              <div className="marketplace-section-block">
                <h3>Campaign brief</h3>
                <p className="marketplace-brief">{listing.brief || "No brief provided."}</p>
              </div>

              <div className="marketplace-section-block">
                <h3>What you’ll create</h3>
                <p>{listing.deliverables || "See brief for deliverables."}</p>
              </div>

              {listing.requiredTasks.length > 0 && (
                <div className="marketplace-section-block">
                  <h3>What you’ll do</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {listing.requiredTasks.map((task) => (
                      <li key={task.id}>{task.title}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(listing.creatorBenefits.guaranteedPaymentCents ||
                listing.productsProvided.length > 0 ||
                listing.creatorBenefits.productsKept ||
                listing.creatorBenefits.bonusEligibility ||
                listing.creatorBenefits.creatorPoolEligibility ||
                listing.creatorBenefits.foundingCreatorRecognition ||
                listing.creatorBenefits.portfolioUse ||
                listing.creatorBenefits.priorityFutureCampaigns ||
                listing.creatorBenefits.brandOpportunityAccess ||
                listing.creatorBenefits.customBenefits.length > 0) && (
                <div className="marketplace-section-block">
                  <h3>What you’ll receive</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {listing.creatorBenefits.guaranteedPaymentCents ? (
                      <li>
                        {new Intl.NumberFormat("en-US", {
                          style: "currency",
                          currency: "USD",
                        }).format(
                          listing.creatorBenefits.guaranteedPaymentCents / 100,
                        )} guaranteed campaign payment
                      </li>
                    ) : null}
                    {listing.productsProvided.map((product) => (
                      <li key={product.id}>
                        {product.name}
                        {product.creatorKeeps ? " — yours to keep" : ""}
                      </li>
                    ))}
                    {listing.creatorBenefits.foundingCreatorRecognition && (
                      <li>Founding Creator campaign participation</li>
                    )}
                    {listing.creatorBenefits.portfolioUse && (
                      <li>Portfolio-ready UGC experience</li>
                    )}
                    {listing.creatorBenefits.priorityFutureCampaigns && (
                      <li>Priority consideration for upcoming campaigns</li>
                    )}
                    {listing.creatorBenefits.creatorPoolEligibility && (
                      <li>Eligibility for future Creator Pool campaigns</li>
                    )}
                    {listing.creatorBenefits.bonusEligibility && (
                      <li>Performance bonus eligibility</li>
                    )}
                    {listing.creatorBenefits.brandOpportunityAccess && (
                      <li>Future brand and boutique opportunities</li>
                    )}
                    {listing.creatorBenefits.customBenefits.map((benefit) => (
                      <li key={benefit}>{benefit}</li>
                    ))}
                  </ul>
                </div>
              )}

              {(contentRights.organicUsage ||
                contentRights.websiteAppUsage ||
                contentRights.paidAdsUsage ||
                contentRights.rawContentAccess ||
                contentRights.duration.trim()) && (
                <div className="marketplace-section-block">
                  <h3>Content rights</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {contentRights.organicUsage && <li>Organic social usage</li>}
                    {contentRights.websiteAppUsage && <li>Website and app usage</li>}
                    {contentRights.paidAdsUsage && <li>Paid ads usage</li>}
                    {contentRights.rawContentAccess && <li>Raw content access</li>}
                    {contentRights.duration.trim() && (
                      <li>Duration: {contentRights.duration}</li>
                    )}
                  </ul>
                </div>
              )}

              {(listing.exampleVideoLinks?.length ?? 0) > 0 && (
                <div className="marketplace-section-block">
                  <h3>Example videos</h3>
                  <p className="workspace-hint" style={{ marginTop: 0 }}>
                    Reference style and quality the brand is looking for.
                  </p>
                  <ul className="marketplace-link-list">
                    {listing.exampleVideoLinks.map((link) => (
                      <li key={link}>
                        <a href={link} target="_blank" rel="noreferrer">
                          {link}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="marketplace-section-block">
                <h3>Who should apply</h3>
                <p className="workspace-hint" style={{ marginTop: 0 }}>
                  Creator criteria for this campaign.
                </p>
                <dl className="marketplace-criteria-grid">
                  {requirementRows.map((row) => (
                    <div className="marketplace-criteria-item" key={`${row.label}-${row.value}`}>
                      <dt>{row.label}</dt>
                      <dd>{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="marketplace-section-block">
                <h3>Files from the brand</h3>
                {listing.files.length === 0 ? (
                  <p className="crm-contact-sub">No files attached.</p>
                ) : (
                  <ul className="marketplace-files">
                    {listing.files.map((file) => (
                      <li key={file.id} className="marketplace-file">
                        <span className="marketplace-file-icon" aria-hidden="true">
                          📎
                        </span>
                        <span>
                          <strong>{file.name}</strong>
                          <small>{file.sizeLabel}</small>
                        </span>
                        <button type="button" className="inbox-btn-text" disabled>
                          Download
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {isBrand && (
                <div className="marketplace-section-block">
                  <h3>Applicants ({applicants.length})</h3>
                  {applicantsError && (
                    <p className="workspace-hint" style={{ marginBottom: 12 }}>
                      {applicantsError}
                    </p>
                  )}
                  {applicants.length === 0 ? (
                    <p className="crm-contact-sub">
                      No applications yet. Creators who apply will appear here with their pitch.
                    </p>
                  ) : (
                    <ul className="marketplace-applicant-list">
                      {applicants.map((application) => (
                        <li key={application.id} className="marketplace-applicant-card">
                          <div className="crm-meta-row" style={{ marginBottom: 8 }}>
                            <span>
                              <strong>{application.creatorName}</strong>
                              <span className="crm-contact-sub" style={{ marginLeft: 8 }}>
                                {application.creatorEmail}
                              </span>
                              <span className="crm-tag" style={{ marginLeft: 8 }}>
                                {APPLICATION_STATUS_LABELS[application.status ?? "pending"]}
                              </span>
                            </span>
                            <span className="crm-contact-sub">
                              {new Date(application.appliedAt).toLocaleString()}
                            </span>
                          </div>
                          <p style={{ margin: "0 0 10px" }}>{application.pitch}</p>
                          {(application.status ?? "pending") === "pending" && (
                            <div style={{ display: "flex", gap: 8 }}>
                              <button
                                type="button"
                                className="crm-btn-primary"
                                disabled={respondingApplicationId === application.id}
                                onClick={() =>
                                  void handleRespond(application.id, "accepted")
                                }
                              >
                                {respondingApplicationId === application.id
                                  ? "Saving…"
                                  : "Accept"}
                              </button>
                              <button
                                type="button"
                                className="crm-btn-secondary"
                                disabled={respondingApplicationId === application.id}
                                onClick={() =>
                                  void handleRespond(application.id, "rejected")
                                }
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>

            <section className="marketplace-panel">
              <h3>Payment details</h3>
              <div className="crm-meta-row">
                <span>Structure</span>
                <span>{PAYMENT_STRUCTURE_LABELS[listing.payment.structure]}</span>
              </div>
              <div className="crm-meta-row">
                <span>Payout summary</span>
                <span className="crm-money">{paymentSummary}</span>
              </div>
              {listing.payment.structure === "milestone" && listing.payment.milestones && (
                <div className="marketplace-milestones">
                  {listing.payment.milestones.map((m) => (
                    <div key={m.label} className="crm-meta-row">
                      <span>
                        {m.label}
                        <small className="crm-contact-sub" style={{ display: "block" }}>
                          {m.trigger}
                        </small>
                      </span>
                      <span className="crm-money">
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                          m.amountCents / 100,
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {listing.payment.structure === "royalty" && (
                <>
                  <div className="crm-meta-row">
                    <span>Commission</span>
                    <span>{listing.payment.royaltyPercent}%</span>
                  </div>
                  {listing.payment.royaltyMinimumCents != null && (
                    <div className="crm-meta-row">
                      <span>Minimum guarantee</span>
                      <span>
                        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                          listing.payment.royaltyMinimumCents / 100,
                        )}
                      </span>
                    </div>
                  )}
                </>
              )}
              {listing.payment.structure === "hybrid" && (
                <>
                  <div className="crm-meta-row">
                    <span>Flat fee</span>
                    <span>
                      {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
                        (listing.payment.hybridFlatCents ?? 0) / 100,
                      )}
                    </span>
                  </div>
                  <div className="crm-meta-row">
                    <span>Royalty</span>
                    <span>{listing.payment.hybridRoyaltyPercent}%</span>
                  </div>
                </>
              )}
              {listing.payment.notes && (
                <p className="crm-contact-sub" style={{ marginTop: 12 }}>
                  {listing.payment.notes}
                </p>
              )}
            </section>
          </div>

          <aside className="marketplace-detail-side">
            <section className="marketplace-panel">
              <h3>Timeline & slots</h3>
              <div className="crm-meta-row">
                <span>Brand</span>
                <span>{listing.brandName}</span>
              </div>
              <div className="crm-meta-row">
                <span>Campaign starts</span>
                <span>{listing.startDate}</span>
              </div>
              <div className="crm-meta-row">
                <span>Campaign ends</span>
                <span>{listing.endDate}</span>
              </div>
              <div className="crm-meta-row">
                <span>Apply by</span>
                <span>{listing.applicationDeadline}</span>
              </div>
              <div className="crm-meta-row">
                <span>Open slots</span>
                <span>{listing.slots}</span>
              </div>
              <div className="crm-meta-row">
                <span>Applicants so far</span>
                <span>{listing.applicantsCount}</span>
              </div>
            </section>

            {listing.brandId && !isBrand && (
              <section className="marketplace-panel">
                <h3>Brand CRM</h3>
                <p className="crm-contact-sub" style={{ marginBottom: 12 }}>
                  This brand is in your CRM. View their profile or pipeline deal.
                </p>
                <Link href={CRM_ROUTES.brand(listing.brandId)} className="crm-btn-secondary" style={{ display: "inline-block" }}>
                  Open brand →
                </Link>
              </section>
            )}

            {isBrand && (
              <section className="marketplace-panel">
                <h3>Invites sent</h3>
                {invites.length === 0 ? (
                  <p className="crm-contact-sub">No creator invites sent for this listing yet.</p>
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
                      <span className="crm-tag">
                        {INVITE_STATUS_LABELS[invite.status]}
                      </span>
                    </div>
                  ))
                )}
              </section>
            )}
          </aside>
        </div>
      </div>

      {showApply && !isBrand && (
        <div className="marketplace-modal-backdrop" onClick={() => setShowApply(false)}>
          <div className="marketplace-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Apply to {listing.name}</h2>
            <p className="crm-contact-sub">
              Send a short pitch to {listing.brandName}. You can optionally add this opportunity to your CRM pipeline.
            </p>
            <form onSubmit={handleApply}>
              <label className="workspace-field workspace-field--full">
                <span>Your pitch</span>
                <textarea
                  rows={5}
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  placeholder="Why you're a fit, relevant experience, availability…"
                  required
                />
              </label>
              <label className="settings-toggle">
                <span className="settings-toggle-copy">
                  <strong>Add to CRM on apply</strong>
                  <span>Creates a lead in your pipeline for this brand and campaign.</span>
                </span>
                <input
                  type="checkbox"
                  checked={addToCrmOnApply}
                  onChange={(e) => setAddToCrmOnApply(e.target.checked)}
                />
              </label>
              <div className="marketplace-modal-footer">
                <button type="button" className="crm-btn-secondary" onClick={() => setShowApply(false)}>
                  Cancel
                </button>
                <button type="submit" className="crm-btn-primary" disabled={submitting}>
                  {submitting ? "Submitting…" : "Submit application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isBrand && (
        <InviteCreatorDrawer
          open={inviteOpen}
          onClose={() => setInviteOpen(false)}
          campaignId={inviteCampaignId}
          campaignName={listing.name}
          brandName={brandName}
          criteria={listingToInviteCriteria(listing)}
          onInvited={refreshInvites}
        />
      )}
    </>
  );
}
