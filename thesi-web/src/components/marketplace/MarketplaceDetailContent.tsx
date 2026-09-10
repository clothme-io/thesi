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
  downloadMarketplaceFile,
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
import {
  BRAND_CAMPAIGN_GOAL_TYPE_LABELS,
  type BrandCampaignHybridPayment,
} from "@/lib/brand-campaigns/types";
import {
  PAYMENT_STRUCTURE_LABELS,
  LISTING_STATUS_LABELS,
  APPLICATION_STATUS_LABELS,
  EMPTY_LISTING_CONTENT_RIGHTS,
  formatListingPayment,
  formatListingContentTypes,
  type MarketplaceBrandApplication,
  type MarketplacePayment,
} from "@/lib/marketplace/types";

type AcceptanceSnapshot = {
  id: string;
  campaignId: string;
  campaignName: string;
  paymentSnapshot: {
    model: "flat_rate" | "milestone" | "royalty" | "hybrid";
    flatRateCents?: number;
    milestoneStructure?: "cumulative" | "highest_achieved";
    milestones?: Array<{
      id: string;
      label: string;
      trigger: string;
      amountCents: number;
    }>;
    royaltyPercent?: number;
    hybrid?: BrandCampaignHybridPayment;
    notes?: string;
  };
  acceptedAt: string;
};

const CAMPAIGN_PAYMENT_LABELS: Record<AcceptanceSnapshot["paymentSnapshot"]["model"], string> = {
  flat_rate: "Flat rate",
  milestone: "Milestone",
  royalty: "Royalty",
  hybrid: "Hybrid",
};

function formatCents(cents = 0): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

function formatAcceptedPayment(
  payment: AcceptanceSnapshot["paymentSnapshot"],
): string {
  switch (payment.model) {
    case "flat_rate":
      return formatCents(payment.flatRateCents);
    case "milestone": {
      const total = (payment.milestones ?? []).reduce(
        (sum, milestone) => sum + milestone.amountCents,
        0,
      );
      return `${formatCents(total)} (milestone)`;
    }
    case "royalty":
      return `${payment.royaltyPercent ?? 0}% royalty`;
    case "hybrid":
      return formatHybridPaymentSummary({
        structure: "hybrid",
        currency: "USD",
        hybridFlatCents: payment.flatRateCents,
        hybridRoyaltyPercent: payment.royaltyPercent,
        hybrid: payment.hybrid,
      });
  }
}

const BASE_TRIGGER_LABELS: Record<string, string> = {
  campaign_accepted: "campaign accepted",
  contract_signed: "contract signed",
  content_submitted: "content submitted",
  content_accepted: "content accepted",
  content_published: "content published",
  campaign_completed: "campaign completed",
};

const HYBRID_METRIC_LABELS: Record<string, string> = {
  views: "views",
  qualified_signups: "qualified signups",
  account_creations: "account creations",
  fit_profiles_completed: "fit profiles completed",
  purchases: "purchases",
  sales_revenue: "sales revenue",
  engagement: "engagement",
  clicks: "clicks",
};

const AFFILIATE_TYPE_LABELS: Record<string, string> = {
  percentage_of_sale: "of each sale",
  percentage_of_platform_commission: "of platform commission",
  fixed_amount_per_sale: "per sale",
};

const POOL_DISTRIBUTION_LABELS: Record<string, string> = {
  impact_score: "Impact Score",
  proportional_performance: "proportional performance",
  equal_distribution: "equal distribution",
  manual: "manual review",
};

function formatHybridPaymentSummary(payment: MarketplacePayment): string {
  const hybrid = payment.hybrid;
  if (!hybrid) {
    return `${formatCents(payment.hybridFlatCents)} + ${payment.hybridRoyaltyPercent ?? 0}%`;
  }
  const parts: string[] = [];
  if (hybrid.base?.enabled) parts.push(formatCents(hybrid.base.amountCents));
  if (hybrid.milestones?.enabled && hybrid.milestones.tiers.length > 0) {
    const amounts = hybrid.milestones.tiers.map((tier) => tier.amountCents);
    const total =
      hybrid.milestones.payoutMethod === "cumulative"
        ? amounts.reduce((sum, amount) => sum + amount, 0)
        : Math.max(0, ...amounts);
    parts.push(`${formatCents(total)} performance`);
  }
  if (hybrid.affiliate?.enabled) parts.push("affiliate");
  if (hybrid.creatorPool?.enabled && (hybrid.creatorPool.poolAmountCents ?? 0) > 0) {
    parts.push(`${formatCents(hybrid.creatorPool.poolAmountCents)} pool`);
  }
  return parts.length > 0 ? parts.join(" + ") : "Hybrid";
}

function HybridPaymentDetails({ payment }: { payment: MarketplacePayment }) {
  const hybrid = payment.hybrid;
  if (!hybrid) {
    return (
      <>
        <div className="crm-meta-row">
          <span>Flat fee</span>
          <span>{formatCents(payment.hybridFlatCents)}</span>
        </div>
        <div className="crm-meta-row">
          <span>Royalty</span>
          <span>{payment.hybridRoyaltyPercent ?? 0}%</span>
        </div>
      </>
    );
  }

  return (
    <div className="marketplace-milestones">
      {hybrid.base?.enabled && (
        <div className="crm-meta-row">
          <span>
            Base payment
            <small className="crm-contact-sub" style={{ display: "block" }}>
              Paid when {hybrid.base.customTrigger || BASE_TRIGGER_LABELS[hybrid.base.trigger] || "earned"}
            </small>
          </span>
          <span className="crm-money">{formatCents(hybrid.base.amountCents)}</span>
        </div>
      )}
      {hybrid.milestones?.enabled && hybrid.milestones.tiers.length > 0 && (
        <>
          <div className="crm-meta-row">
            <span>Performance metric</span>
            <span>
              {hybrid.milestones.customMetric ||
                HYBRID_METRIC_LABELS[hybrid.milestones.metric] ||
                "Performance"}
            </span>
          </div>
          <div className="crm-meta-row">
            <span>Milestone structure</span>
            <span>
              {hybrid.milestones.payoutMethod === "cumulative"
                ? "Cumulative"
                : "Highest achieved"}
            </span>
          </div>
          {hybrid.milestones.tiers.map((tier) => (
            <div key={tier.id || tier.label} className="crm-meta-row">
              <span>
                {tier.label}
                <small className="crm-contact-sub" style={{ display: "block" }}>
                  {tier.trigger}
                </small>
              </span>
              <span className="crm-money">{formatCents(tier.amountCents)}</span>
            </div>
          ))}
        </>
      )}
      {hybrid.affiliate?.enabled && (
        <div className="crm-meta-row">
          <span>
            Affiliate commission
            <small className="crm-contact-sub" style={{ display: "block" }}>
              {hybrid.affiliate.attributionWindowDays
                ? `${hybrid.affiliate.attributionWindowDays}-day attribution`
                : "Attribution terms apply"}
            </small>
          </span>
          <span>
            {hybrid.affiliate.commissionType === "fixed_amount_per_sale"
              ? `${formatCents(hybrid.affiliate.fixedAmountCents)} per sale`
              : `${hybrid.affiliate.commissionPercent ?? 0}% ${AFFILIATE_TYPE_LABELS[hybrid.affiliate.commissionType]}`}
          </span>
        </div>
      )}
      {hybrid.creatorPool?.enabled && (
        <div className="crm-meta-row">
          <span>
            Creator Pool
            <small className="crm-contact-sub" style={{ display: "block" }}>
              Distributed by {hybrid.creatorPool.customDistributionMethod ||
                POOL_DISTRIBUTION_LABELS[hybrid.creatorPool.distributionMethod] ||
                "campaign rules"}
            </small>
          </span>
          <span className="crm-money">{formatCents(hybrid.creatorPool.poolAmountCents)}</span>
        </div>
      )}
    </div>
  );
}

function splitReadableSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"$])/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function sentenceChunks(text: string): string[] {
  const sentences = splitReadableSentences(text);
  if (sentences.length <= 1) return text.trim() ? [text.trim()] : [];
  const chunks: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    chunks.push(sentences.slice(i, i + 2).join(" "));
  }
  return chunks;
}

function renderReadableInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={`${part}-${index}`}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}

function cleanListItem(text: string): string {
  return text.replace(/^(\d+\.\s+|[-*•]\s+)/, "").trim();
}

function FormattedCampaignText({
  text,
  fallback,
}: {
  text?: string;
  fallback: string;
}) {
  const source = text?.trim() || fallback;
  const blocks = source
    .replace(/\r\n/g, "\n")
    .replace(/\s+(Supporting Content|Important:|Please Note:)\s*/g, "\n\n$1 ")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="marketplace-readable-text">
      {blocks.map((block, blockIndex) => {
        const numberedLines = block
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean);
        if (
          numberedLines.length > 1 &&
          numberedLines.every((line) => /^\d+\.\s+/.test(line))
        ) {
          return (
            <ol key={`numbered-${blockIndex}`}>
              {numberedLines.map((line) => (
                <li key={line}>{renderReadableInline(cleanListItem(line))}</li>
              ))}
            </ol>
          );
        }

        if (
          numberedLines.length > 1 &&
          numberedLines.every((line) => /^[-*•]\s+/.test(line))
        ) {
          return (
            <ul key={`line-bullets-${blockIndex}`}>
              {numberedLines.map((line) => (
                <li key={line}>{renderReadableInline(cleanListItem(line))}</li>
              ))}
            </ul>
          );
        }

        if (block.includes("•")) {
          const [intro, ...items] = block
            .split(/\s*•\s*/)
            .map((part) => part.trim())
            .filter(Boolean);
          return (
            <div key={`bullets-${blockIndex}`}>
              {sentenceChunks(intro).map((chunk) => (
                <p key={chunk}>{renderReadableInline(chunk)}</p>
              ))}
              {items.length > 0 && (
                <ul>
                  {items.map((item) => (
                    <li key={item}>{renderReadableInline(item)}</li>
                  ))}
                </ul>
              )}
            </div>
          );
        }

        return sentenceChunks(block).map((chunk) => (
          <p key={`${blockIndex}-${chunk}`}>{renderReadableInline(chunk)}</p>
        ));
      })}
    </div>
  );
}

export function MarketplaceDetailContent() {
  const params = useParams();
  const listingId = params.id as string;
  const { session, authenticatedRequest, authenticatedBinaryRequest } = useAuth();
  const isBrand = session?.user.role === "brand";
  const { data, ready, error, reload, applyToListing, linkListingToCrm } =
    useMarketplace(authenticatedRequest);
  const { data: inviteData, ready: invitesReady, reload: reloadInvites } =
    useInvites(authenticatedRequest, isBrand);
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
  const [acceptanceSnapshot, setAcceptanceSnapshot] =
    useState<AcceptanceSnapshot | null>(null);

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

  useEffect(() => {
    if (isBrand || !listingId) {
      setAcceptanceSnapshot(null);
      return;
    }
    const listing = data.listings.find((item) => item.id === listingId);
    if (!listing?.campaignId) {
      setAcceptanceSnapshot(null);
      return;
    }
    let active = true;
    authenticatedRequest<{ snapshot: AcceptanceSnapshot | null }>(
      `/api/invites/campaign/acceptance-snapshot?campaignId=${encodeURIComponent(
        listing.campaignId,
      )}`,
    )
      .then((data) => {
        if (active) setAcceptanceSnapshot(data.snapshot);
      })
      .catch(() => {
        if (active) setAcceptanceSnapshot(null);
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest, data.listings, isBrand, listingId]);

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
  const acceptedPaymentSummary = acceptanceSnapshot
    ? formatAcceptedPayment(acceptanceSnapshot.paymentSnapshot)
    : null;
  const contentTypesSummary = formatListingContentTypes(listing.contentTypes);
  const contentRights = listing.contentRights ?? EMPTY_LISTING_CONTENT_RIGHTS;
  const showCreatorDisclosure = !isBrand && (listing.creatorDisclosureEnabled ?? false);
  const paymentCalloutText = acceptanceSnapshot
    ? [
        `${CAMPAIGN_PAYMENT_LABELS[acceptanceSnapshot.paymentSnapshot.model]} terms accepted on ${new Date(
          acceptanceSnapshot.acceptedAt,
        ).toLocaleDateString()}.`,
        acceptanceSnapshot.paymentSnapshot.notes,
      ]
        .filter(Boolean)
        .join("\n\n")
    : listing.payment.notes
      ? `${PAYMENT_STRUCTURE_LABELS[listing.payment.structure]}\n\n${listing.payment.notes}`
      : PAYMENT_STRUCTURE_LABELS[listing.payment.structure];

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
      await reload();
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
                  <span className="marketplace-pay-callout-label">
                    {acceptedPaymentSummary
                      ? "Accepted compensation"
                      : "Creator payout"}
                  </span>
                  <strong className="marketplace-pay-callout-value">
                    {acceptedPaymentSummary ?? paymentSummary}
                  </strong>
                  <div className="marketplace-pay-callout-note">
                    <FormattedCampaignText
                      text={paymentCalloutText}
                      fallback={PAYMENT_STRUCTURE_LABELS[listing.payment.structure]}
                    />
                  </div>
                </div>
              </div>

              {showCreatorDisclosure && (
                <div className="marketplace-disclosure">
                  <strong>Campaign disclosure</strong>
                  <p>
                    This campaign brief is not a contract and is non-binding until the brand and creator confirm final terms. Payment, deliverables, timelines, content rights, and usage terms may be finalized separately.
                  </p>
                </div>
              )}

              <div className="marketplace-section-block">
                <h3>Campaign brief</h3>
                <FormattedCampaignText
                  text={listing.brief}
                  fallback="No brief provided."
                />
              </div>

              <div className="marketplace-section-block">
                <h3>What you’ll create</h3>
                <FormattedCampaignText
                  text={listing.deliverables}
                  fallback="See brief for deliverables."
                />
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
                        <button
                          type="button"
                          className="inbox-btn-text"
                          onClick={async () => {
                            setActionError("");
                            try {
                              await downloadMarketplaceFile(
                                authenticatedBinaryRequest,
                                listing.id,
                                file,
                              );
                            } catch (requestError) {
                              setActionError(
                                requestError instanceof Error
                                  ? requestError.message
                                  : "Could not download file",
                              );
                            }
                          }}
                        >
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
                <HybridPaymentDetails payment={listing.payment} />
              )}
              {listing.payment.notes && (
                <div className="marketplace-section-note">
                  <FormattedCampaignText
                    text={listing.payment.notes}
                    fallback=""
                  />
                </div>
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
                <span>Total slots</span>
                <span>{listing.totalSlots ?? listing.slots}</span>
              </div>
              <div className="crm-meta-row">
                <span>Slots left</span>
                <span>{listing.slotsLeft ?? listing.slots}</span>
              </div>
              <div className="crm-meta-row">
                <span>Accepted creators</span>
                <span>{listing.acceptedCreatorsCount ?? 0}</span>
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
            {showCreatorDisclosure && (
              <div className="marketplace-disclosure marketplace-disclosure--modal">
                <strong>Campaign disclosure</strong>
                <p>
                  This campaign brief is not a contract and is non-binding until the brand and creator confirm final terms.
                </p>
              </div>
            )}
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
