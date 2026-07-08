"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useBrandCampaigns } from "@/lib/brand-campaigns/storage";
import {
  BRAND_CAMPAIGN_STATUS_LABELS,
  BRAND_CAMPAIGN_TYPE_LABELS,
  getCampaignBudgetLabel,
  type BrandCampaignStatus,
} from "@/lib/brand-campaigns/types";

const STATUS_FILTERS: Array<BrandCampaignStatus | "all"> = [
  "all",
  "draft",
  "active",
  "paused",
  "completed",
];

export function CampaignsPageContent() {
  const { data, ready } = useBrandCampaigns();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<BrandCampaignStatus | "all">("all");

  const campaigns = useMemo(() => {
    const q = query.trim().toLowerCase();
    return data.campaigns.filter((campaign) => {
      if (status !== "all" && campaign.status !== status) return false;
      if (!q) return true;
      return (
        campaign.name.toLowerCase().includes(q) ||
        campaign.brief.toLowerCase().includes(q) ||
        BRAND_CAMPAIGN_TYPE_LABELS[campaign.type].toLowerCase().includes(q)
      );
    });
  }, [data.campaigns, query, status]);

  if (!ready) return null;

  return (
    <>
      <header className="app-topbar">
        <h1>Campaigns</h1>
        <Link href="/app/campaigns/new" className="crm-btn-primary">
          + New campaign
        </Link>
      </header>
      <div className="app-content">
        <div className="marketplace-toolbar">
          <input
            className="crm-search"
            placeholder="Search campaigns..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select className="crm-filter" value={status} onChange={(e) => setStatus(e.target.value as BrandCampaignStatus | "all")}>
            {STATUS_FILTERS.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "All statuses" : BRAND_CAMPAIGN_STATUS_LABELS[item]}
              </option>
            ))}
          </select>
        </div>

        <div className="brand-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Campaign</th>
                <th>Type</th>
                <th>Status</th>
                <th>Start</th>
                <th>End</th>
                <th>Payment</th>
                <th>Marketplace</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td>
                    <Link href={`/app/campaigns/${campaign.id}`}>{campaign.name}</Link>
                  </td>
                  <td>{BRAND_CAMPAIGN_TYPE_LABELS[campaign.type]}</td>
                  <td>{BRAND_CAMPAIGN_STATUS_LABELS[campaign.status]}</td>
                  <td>{campaign.startDate}</td>
                  <td>{campaign.endDate}</td>
                  <td>{getCampaignBudgetLabel(campaign)}</td>
                  <td>{campaign.postToMarketplace ? "Posted" : "Private"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {campaigns.length === 0 && <p className="workspace-hint">No campaigns match your filters.</p>}
        </div>
      </div>
    </>
  );
}

