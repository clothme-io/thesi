"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { CreatorTrackingLink } from "@/components/brand/campaigns/CreatorTrackingLink";

type CreatorLinkRow = {
  campaignId: string;
  name: string;
  productTitle: string | null;
  productId: string | null;
  commissionType: string | null;
  linkType: "install" | "sale";
  url: string | null;
};

function groupLinksByCampaign(rows: CreatorLinkRow[]) {
  const campaigns: Array<{
    campaignId: string;
    name: string;
    links: CreatorLinkRow[];
  }> = [];
  for (const row of rows) {
    const existing = campaigns.find(
      (campaign) => campaign.campaignId === row.campaignId,
    );
    if (existing) existing.links.push(row);
    else
      campaigns.push({
        campaignId: row.campaignId,
        name: row.name,
        links: [row],
      });
  }
  return campaigns;
}

export function CreatorLinksPageContent() {
  const { authenticatedRequest } = useAuth();
  const [campaigns, setCampaigns] = useState<CreatorLinkRow[] | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    authenticatedRequest<{ enabled: boolean; campaigns: CreatorLinkRow[] }>(
      "/api/creator-tracking/links",
    )
      .then((data) => {
        if (!active) return;
        setEnabled(data.enabled);
        setCampaigns(data.campaigns);
      })
      .catch((err) => {
        if (active)
          setError(
            err instanceof Error ? err.message : "Could not load creator links",
          );
      });
    return () => {
      active = false;
    };
  }, [authenticatedRequest]);

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Creator links</h1>
          <span className="workspace-subtitle">
            ClothME product links for campaigns you accepted. Each product has
            its own copyable link.
          </span>
        </div>
      </header>
      <div className="app-content">
        {error ? (
          <section className="app-panel" role="alert">
            <h2>Links unavailable</h2>
            <p>{error}</p>
          </section>
        ) : campaigns === null ? (
          <section className="app-panel" role="status">
            <h2>Loading links</h2>
            <p>Checking accepted commission campaigns.</p>
          </section>
        ) : !enabled ? (
          <section className="app-panel">
            <h2>Creator links are paused</h2>
            <p>New personal links are not available right now.</p>
          </section>
        ) : campaigns.length === 0 ? (
          <section className="app-panel">
            <h2>No commission campaigns yet</h2>
            <p>
              Accept a sale or install commission campaign, then your unique
              promote link will appear here.
            </p>
          </section>
        ) : (
          groupLinksByCampaign(campaigns).map((campaign) => (
            <section className="app-panel" key={campaign.campaignId}>
              <h2>{campaign.name}</h2>
              {campaign.links.map((link) => (
                <CreatorTrackingLink
                  key={link.productId ?? "install"}
                  campaignId={link.campaignId}
                  productId={link.productId ?? undefined}
                  productTitle={link.productTitle ?? undefined}
                  install={link.linkType === "install"}
                  initialUrl={link.url ?? undefined}
                />
              ))}
            </section>
          ))
        )}
      </div>
    </>
  );
}
