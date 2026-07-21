"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { useMarketplace } from "@/lib/marketplace/storage";
import { getListingsForBrand } from "@/lib/marketplace/listings";
import { MARKETPLACE_ROUTES } from "@/lib/marketplace/routes";
import { BRAND_CAMPAIGN_GOAL_TYPE_LABELS } from "@/lib/brand-campaigns/types";
import {
  LISTING_TYPE_LABELS,
  PAYMENT_STRUCTURE_LABELS,
  LISTING_STATUS_LABELS,
  formatListingPayment,
  type MarketplaceListingType,
  type PaymentStructure,
  type MarketplaceListingStatus,
} from "@/lib/marketplace/types";

const TYPE_OPTIONS: Array<MarketplaceListingType | "all"> = [
  "all",
  "tiktok",
  "instagram_reels",
  "youtube_shorts",
  "ugc_photos",
  "mixed_bundle",
  "long_form",
];

const PAYMENT_OPTIONS: Array<PaymentStructure | "all"> = [
  "all",
  "flat_rate",
  "milestone",
  "royalty",
  "hybrid",
];

const STATUS_OPTIONS: Array<MarketplaceListingStatus | "all"> = ["all", "open", "closing_soon", "closed"];

export function MarketplacePageContent() {
  const { session, authenticatedRequest } = useAuth();
  const isBrand = session?.user.role === "brand";
  const userId = session?.user.id ?? "dev-user-1";
  const { data, ready, error } = useMarketplace(authenticatedRequest);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<MarketplaceListingType | "all">("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentStructure | "all">("all");
  const [statusFilter, setStatusFilter] = useState<MarketplaceListingStatus | "all">("all");

  const sourceListings = useMemo(() => {
    if (isBrand) {
      return getListingsForBrand(data.listings, userId);
    }
    return data.listings;
  }, [data.listings, isBrand, userId]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sourceListings.filter((listing) => {
      if (typeFilter !== "all" && listing.type !== typeFilter) return false;
      if (paymentFilter !== "all" && listing.payment.structure !== paymentFilter) return false;
      if (statusFilter !== "all" && listing.status !== statusFilter) return false;
      if (!query) return true;
      return (
        listing.name.toLowerCase().includes(query) ||
        listing.brandName.toLowerCase().includes(query) ||
        listing.brief.toLowerCase().includes(query)
      );
    });
  }, [sourceListings, search, typeFilter, paymentFilter, statusFilter]);

  if (!ready) return null;

  const appliedCount = data.applications.length;
  const myListingCount = getListingsForBrand(data.listings, userId).length;

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Marketplace</h1>
          <span className="workspace-subtitle">
            {isBrand
              ? `${myListingCount} your listing${myListingCount === 1 ? "" : "s"} · post from Campaigns`
              : `${filtered.length} opportunities · ${appliedCount} applied`}
          </span>
        </div>
        {isBrand && (
          <Link href="/app/campaigns/new" className="crm-btn-primary">
            + New campaign
          </Link>
        )}
      </header>

      <div className="app-content">
        {error && <p className="workspace-hint">{error}</p>}
        {isBrand && (
          <p className="workspace-hint" style={{ marginTop: 0, marginBottom: 16 }}>
            Your posted campaigns appear here. Enable &quot;Post to marketplace&quot; when creating or activating a campaign.
          </p>
        )}

        <div className="marketplace-toolbar">
          <input
            type="search"
            className="crm-search"
            placeholder={isBrand ? "Search your listings…" : "Search campaigns, brands…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="crm-filter"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all" ? "All content types" : LISTING_TYPE_LABELS[opt]}
              </option>
            ))}
          </select>
          <select
            className="crm-filter"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value as typeof paymentFilter)}
          >
            {PAYMENT_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all" ? "All payment" : PAYMENT_STRUCTURE_LABELS[opt]}
              </option>
            ))}
          </select>
          <select
            className="crm-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "all" ? "All status" : LISTING_STATUS_LABELS[opt]}
              </option>
            ))}
          </select>
        </div>

        <div className="marketplace-grid">
          {filtered.length === 0 ? (
            <div className="app-panel">
              {isBrand ? (
                <>
                  <p>No marketplace listings yet.</p>
                  <Link href="/app/campaigns/new" className="crm-btn-primary" style={{ display: "inline-block", marginTop: 12 }}>
                    Create a campaign and post to marketplace
                  </Link>
                </>
              ) : (
                <p>No listings match your filters.</p>
              )}
            </div>
          ) : (
            filtered.map((listing) => {
              const applied = data.applications.some((a) => a.listingId === listing.id);
              const inCrm = data.crmLinkedListingIds.includes(listing.id);
              return (
                <Link
                  key={listing.id}
                  href={MARKETPLACE_ROUTES.listing(listing.id)}
                  className="marketplace-card"
                >
                  <div className="marketplace-card-top">
                    <span className={`marketplace-status marketplace-status--${listing.status}`}>
                      {LISTING_STATUS_LABELS[listing.status]}
                    </span>
                    {isBrand && listing.campaignId && (
                      <span className="marketplace-badge marketplace-badge--crm">Your campaign</span>
                    )}
                    {!isBrand && applied && <span className="marketplace-badge">Applied</span>}
                    {!isBrand && inCrm && <span className="marketplace-badge marketplace-badge--crm">In CRM</span>}
                  </div>
                  <h2>{listing.name}</h2>
                  <p className="marketplace-brand">{listing.brandName}</p>
                  <div className="marketplace-card-meta">
                    <span>
                      {BRAND_CAMPAIGN_GOAL_TYPE_LABELS[listing.campaignType] ??
                        listing.campaignType}
                    </span>
                    <span>{LISTING_TYPE_LABELS[listing.type]}</span>
                    <span>{formatListingPayment(listing.payment)}</span>
                  </div>
                  <p className="marketplace-card-brief">{listing.brief}</p>
                  <div className="marketplace-card-dates">
                    <span>
                      {listing.startDate} → {listing.endDate}
                    </span>
                    <span>Apply by {listing.applicationDeadline}</span>
                  </div>
                  <div className="marketplace-card-footer">
                    <span>{listing.slots} slots</span>
                    <span>{listing.applicantsCount} applicants</span>
                    <span>{listing.remoteOk ? "Remote OK" : listing.location}</span>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
