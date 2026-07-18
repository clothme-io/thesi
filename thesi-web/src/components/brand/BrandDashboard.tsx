"use client";

import Link from "next/link";
import { useBrandCampaigns, getBrandDashboardMetrics } from "@/lib/brand-campaigns/storage";
import { getCampaignBudgetLabel } from "@/lib/brand-campaigns/types";
import { useAuth } from "@/context/AuthProvider";

export function BrandDashboard() {
  const { authenticatedRequest } = useAuth();
  const { data, ready, error } = useBrandCampaigns(authenticatedRequest);
  if (!ready) return null;

  const metrics = getBrandDashboardMetrics(data);
  const recent = [...data.campaigns].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  return (
    <>
      <header className="app-topbar">
        <h1>Dashboard</h1>
        <span className="workspace-subtitle">Brand workspace</span>
      </header>
      <div className="app-content">
        {error && <p className="workspace-hint">{error}</p>}
        <div className="app-dashboard-grid">
          <div className="app-stat-card">
            <span>Total campaigns</span>
            <strong>{metrics.total}</strong>
          </div>
          <div className="app-stat-card">
            <span>Active campaigns</span>
            <strong>{metrics.active}</strong>
          </div>
          <div className="app-stat-card">
            <span>Draft campaigns</span>
            <strong>{metrics.draft}</strong>
          </div>
          <div className="app-stat-card">
            <span>Posted to marketplace</span>
            <strong>{metrics.posted}</strong>
          </div>
          <div className="app-stat-card">
            <span>Closing soon</span>
            <strong>{metrics.closingSoon}</strong>
          </div>
        </div>

        <div className="workspace-section">
          <div className="brand-dashboard-header">
            <h3>Recent campaigns</h3>
            <Link href="/app/campaigns/new" className="crm-btn-primary">
              + New campaign
            </Link>
          </div>
          <div className="brand-table-wrap">
            <table className="crm-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Timeline</th>
                  <th>Payment</th>
                  <th>Marketplace</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((campaign) => (
                  <tr key={campaign.id}>
                    <td>
                      <Link href={`/app/campaigns/${campaign.id}`}>{campaign.name}</Link>
                    </td>
                    <td>{campaign.status}</td>
                    <td>
                      {campaign.startDate} → {campaign.endDate}
                    </td>
                    <td>{getCampaignBudgetLabel(campaign)}</td>
                    <td>{campaign.postToMarketplace ? "Posted" : "Private"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
