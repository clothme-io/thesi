"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { formatCount } from "@/lib/creators/types";

type CampaignContentItem = {
  id: string;
  campaignId: string;
  creatorUserId: string;
  provider: string;
  url: string;
  title: string;
  views: number;
  likes: number;
  comments: number;
  lastSyncedAt: string | null;
  lastError: string | null;
};

type Props = {
  campaignId: string;
  canAttach: boolean;
};

const PROVIDER_LABEL: Record<string, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
};

export function CampaignPublishedContent({ campaignId, canAttach }: Props) {
  const { authenticatedRequest, session } = useAuth();
  const isBrand = session?.user.role === "brand";
  const [items, setItems] = useState<CampaignContentItem[]>([]);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const next = await authenticatedRequest<{ items?: CampaignContentItem[] }>(
      `/api/social/campaigns/${campaignId}/content`,
      { method: "GET" },
    );
    setItems(next?.items ?? []);
  }, [authenticatedRequest, campaignId]);

  useEffect(() => {
    void load().catch((requestError) => {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Could not load published posts",
      );
    });
  }, [load]);

  const run = async (key: string, work: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await work();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "Request failed",
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <section className={isBrand ? "crm-detail-panel" : "marketplace-panel"}>
      <h3>Published posts</h3>
      <p className="workspace-hint" style={{ marginTop: 0 }}>
        {canAttach
          ? "Attach a live TikTok, Instagram, or YouTube post from a verified account. Thesi reads views, likes, and comments only."
          : "Live views, likes, and comments from posts creators attached after accepting this campaign."}
      </p>
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      {canAttach ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.tiktok.com/@you/video/…"
            style={{ flex: "1 1 220px" }}
          />
          <button
            type="button"
            className="crm-btn-primary"
            disabled={!url.trim() || Boolean(busy)}
            onClick={() =>
              void run("attach", async () => {
                await authenticatedRequest(
                  `/api/social/campaigns/${campaignId}/content`,
                  { method: "POST", body: { url } },
                );
                setUrl("");
                await load();
              })
            }
          >
            {busy === "attach" ? "Attaching…" : "Attach post"}
          </button>
        </div>
      ) : null}
      {items.length === 0 ? (
        <p className="workspace-hint">No published posts attached yet.</p>
      ) : (
        <div className="brand-ugc-table-wrap">
          <table className="brand-ugc-table">
            <thead>
              <tr>
                <th>Post</th>
                <th>Platform</th>
                <th>Views</th>
                <th>Likes</th>
                <th>Comments</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <a href={item.url} target="_blank" rel="noreferrer">
                      {item.title || item.url}
                    </a>
                    {item.lastError ? (
                      <span className="workspace-hint" style={{ display: "block" }}>
                        {item.lastError}
                      </span>
                    ) : null}
                  </td>
                  <td>{PROVIDER_LABEL[item.provider] || item.provider}</td>
                  <td>{formatCount(item.views)}</td>
                  <td>{formatCount(item.likes)}</td>
                  <td>{formatCount(item.comments)}</td>
                  <td>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        className="crm-btn-secondary"
                        disabled={Boolean(busy)}
                        onClick={() =>
                          void run(`refresh-${item.id}`, async () => {
                            await authenticatedRequest(
                              `/api/social/campaigns/${campaignId}/content/${item.id}/refresh`,
                              { method: "POST" },
                            );
                            await load();
                          })
                        }
                      >
                        {busy === `refresh-${item.id}` ? "Refreshing…" : "Refresh"}
                      </button>
                      {(canAttach || isBrand) && (
                        <button
                          type="button"
                          className="crm-btn-secondary"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            void run(`remove-${item.id}`, async () => {
                              await authenticatedRequest(
                                `/api/social/campaigns/${campaignId}/content/${item.id}`,
                                { method: "DELETE" },
                              );
                              await load();
                            })
                          }
                        >
                          {busy === `remove-${item.id}` ? "Removing…" : "Remove"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
