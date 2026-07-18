"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { InviteCreatorDrawer } from "@/components/brand/campaigns/InviteCreatorDrawer";
import {
  useMarketplace,
  getListingById,
  hasApplied,
  isInCrm,
} from "@/lib/marketplace/storage";
import { listingInviteCampaignId, listingToInviteCriteria } from "@/lib/marketplace/invite-criteria";
import { MARKETPLACE_ROUTES } from "@/lib/marketplace/routes";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";
import { getInvitesForCampaign, useInvites } from "@/lib/invites/storage";
import {
  LISTING_TYPE_LABELS,
  PAYMENT_STRUCTURE_LABELS,
  LISTING_STATUS_LABELS,
  formatListingPayment,
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

  if (!ready || (isBrand && !invitesReady)) return null;

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
  const brandName = session?.user.fullName ?? listing.brandName;
  const inviteCampaignId = listingInviteCampaignId(listing);
  const invites = isBrand ? getInvitesForCampaign(inviteData, inviteCampaignId) : [];

  const refreshInvites = () => {
    void reloadInvites(inviteCampaignId);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
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

  return (
    <>
      <header className="app-topbar">
        <div>
          <Link href={MARKETPLACE_ROUTES.list} className="auth-link" style={{ fontSize: 13 }}>
            ← Marketplace
          </Link>
          <h1 style={{ marginTop: 4 }}>{listing.name}</h1>
          <span className="workspace-subtitle">
            {listing.brandName} · {LISTING_TYPE_LABELS[listing.type]}
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
                <span className="marketplace-badge marketplace-badge--applied">Applied</span>
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
            <section className="workspace-section">
              <div className="marketplace-detail-badges">
                <span className={`marketplace-status marketplace-status--${listing.status}`}>
                  {LISTING_STATUS_LABELS[listing.status]}
                </span>
                <span className="marketplace-tag">{LISTING_TYPE_LABELS[listing.type]}</span>
                <span className="marketplace-tag">{PAYMENT_STRUCTURE_LABELS[listing.payment.structure]}</span>
              </div>

              <h3>Brief</h3>
              <p className="marketplace-brief">{listing.brief}</p>

              <h3 style={{ marginTop: 24 }}>Deliverables</h3>
              <p>{listing.deliverables}</p>

              <h3 style={{ marginTop: 24 }}>Requirements</h3>
              <ul className="marketplace-requirements">
                {listing.requirements.map((req) => (
                  <li key={req}>{req}</li>
                ))}
              </ul>

              <h3 style={{ marginTop: 24 }}>Files</h3>
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
            </section>

            <section className="workspace-section">
              <h3>Payment</h3>
              <div className="crm-meta-row">
                <span>Structure</span>
                <span>{PAYMENT_STRUCTURE_LABELS[listing.payment.structure]}</span>
              </div>
              <div className="crm-meta-row">
                <span>Summary</span>
                <span className="crm-money">{formatListingPayment(listing.payment)}</span>
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
            <section className="workspace-section">
              <h3>Campaign details</h3>
              <div className="crm-meta-row">
                <span>Brand</span>
                <span>{listing.brandName}</span>
              </div>
              <div className="crm-meta-row">
                <span>Start date</span>
                <span>{listing.startDate}</span>
              </div>
              <div className="crm-meta-row">
                <span>End date</span>
                <span>{listing.endDate}</span>
              </div>
              <div className="crm-meta-row">
                <span>Apply by</span>
                <span>{listing.applicationDeadline}</span>
              </div>
              <div className="crm-meta-row">
                <span>Location</span>
                <span>{listing.remoteOk ? `Remote · ${listing.location}` : listing.location}</span>
              </div>
              <div className="crm-meta-row">
                <span>Slots</span>
                <span>{listing.slots}</span>
              </div>
              <div className="crm-meta-row">
                <span>Applicants</span>
                <span>{listing.applicantsCount}</span>
              </div>
            </section>

            {listing.brandId && !isBrand && (
              <section className="workspace-section">
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
              <section className="workspace-section">
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
                      <span>{invite.status}</span>
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
