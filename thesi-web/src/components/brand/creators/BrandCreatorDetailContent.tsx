"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import {
  isFavorite,
  useBrandCreatorFavorites,
  useCreatorDirectoryProfile,
} from "@/lib/brand-creators/storage";
import { BRAND_CREATORS_ROUTES } from "@/lib/brand-creators/routes";
import {
  formatCount,
  formatFollowers,
  formatPercent,
  formatStatCount,
  formatStatPercent,
  formatSyncedAgo,
  hasConnectedStats,
  isConnectedPlatformSource,
} from "@/lib/creators/types";

export function BrandCreatorDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { authenticatedRequest } = useAuth();
  const { creator, ready: creatorReady, error: creatorError } =
    useCreatorDirectoryProfile(authenticatedRequest, id);
  const {
    data: favData,
    ready: favoritesReady,
    toggleFavorite,
  } = useBrandCreatorFavorites(authenticatedRequest);
  const [actionError, setActionError] = useState("");

  if (!creatorReady || !favoritesReady) return null;

  if (!creator) {
    return (
      <div className="app-content">
        <p>
          {creatorError || "Creator not found."}{" "}
          <Link href={BRAND_CREATORS_ROUTES.list}>Back to creators</Link>
        </p>
      </div>
    );
  }

  const fav = isFavorite(favData, creator.id);
  const connected = hasConnectedStats(creator.stats);
  const syncedAgo = formatSyncedAgo(creator.statsSyncedAt);

  return (
    <>
      <header className="app-topbar">
        <div>
          <Link href={BRAND_CREATORS_ROUTES.list} className="auth-link" style={{ fontSize: 13 }}>
            ← Creators
          </Link>
          <h1 style={{ marginTop: 4 }}>
            {creator.name}
            {connected && (
              <span
                className="marketplace-badge marketplace-badge--applied"
                style={{ marginLeft: 10, verticalAlign: "middle" }}
              >
                Connected
              </span>
            )}
          </h1>
          <span className="workspace-subtitle">
            {creator.platforms.join(" · ") || "No platforms"} · {creator.location || "—"}
          </span>
        </div>
        <button
          type="button"
          className={`crm-btn-secondary ${fav ? "brand-creator-fav-btn--active" : ""}`}
          onClick={async () => {
            setActionError("");
            try {
              await toggleFavorite(creator.id);
            } catch (requestError) {
              setActionError(
                requestError instanceof Error
                  ? requestError.message
                  : "Could not update favorite",
              );
            }
          }}
        >
          {fav ? "★ Favorited" : "☆ Add to favorites"}
        </button>
      </header>

      <div className="app-content">
        {actionError && <p className="workspace-hint">{actionError}</p>}
        <div className="crm-detail-grid">
          <div>
            <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
              <h3>About</h3>
              <p>{creator.bio}</p>
              <div className="crm-tags" style={{ marginTop: 12 }}>
                {creator.niches.map((tag) => (
                  <span key={tag} className="crm-tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="crm-meta-row" style={{ marginTop: 16 }}>
                <span>Email</span>
                <span>{creator.email}</span>
              </div>
              <div className="crm-meta-row">
                <span>Follower range</span>
                <span>{creator.followerRange || "—"}</span>
              </div>
            </div>

            <div className="crm-detail-panel">
              <h3>UGC posts</h3>
              <p className="workspace-hint" style={{ marginTop: 0 }}>
                Analyze views, comments, and engagement on past brand content.
              </p>
              {creator.ugcPosts.length === 0 ? (
                <p className="workspace-hint">
                  This creator has not added work yet.
                </p>
              ) : (
                <div className="brand-ugc-table-wrap">
                  <table className="brand-table brand-ugc-table">
                    <thead>
                      <tr>
                        <th>Post</th>
                        <th>Platform</th>
                        <th>Campaign</th>
                        <th>Views</th>
                        <th>Likes</th>
                        <th>Comments</th>
                        <th>Shares</th>
                        <th>Saves</th>
                        <th>Posted</th>
                      </tr>
                    </thead>
                    <tbody>
                      {creator.ugcPosts.map((post) => (
                        <tr key={post.id}>
                          <td>
                            {post.url ? (
                              <a href={post.url} target="_blank" rel="noreferrer">
                                <strong>{post.title}</strong>
                              </a>
                            ) : (
                              <strong>{post.title}</strong>
                            )}
                            {post.brandName && (
                              <span className="brand-ugc-brand" style={{ display: "block" }}>
                                {post.brandName}
                              </span>
                            )}
                          </td>
                          <td>
                            {post.platform}
                            {isConnectedPlatformSource(post.source) ? (
                              <span
                                className="workspace-hint"
                                style={{ display: "block", margin: 0 }}
                              >
                                Synced
                              </span>
                            ) : null}
                          </td>
                          <td>{post.campaignName ?? "—"}</td>
                          <td>{formatCount(post.views)}</td>
                          <td>{formatCount(post.likes)}</td>
                          <td>{formatCount(post.comments)}</td>
                          <td>{formatCount(post.shares)}</td>
                          <td>{post.saves > 0 ? formatCount(post.saves) : "—"}</td>
                          <td>{post.postedAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <aside>
            <div className="crm-detail-panel" style={{ marginBottom: 16 }}>
              <h3>Performance stats</h3>
              <p className="workspace-hint" style={{ marginTop: 0 }}>
                {connected
                  ? "Followers and views include connected social accounts. Campaigns done and response rate come from Thesi invites."
                  : "Followers and views are self-reported until social accounts are connected. Campaigns done and response rate come from Thesi invites."}
                {syncedAgo ? ` ${syncedAgo}.` : ""}
              </p>
              <div className="brand-creator-stats-grid">
                <div className="brand-creator-stat">
                  <strong>
                    {formatFollowers(
                      creator.stats.totalFollowers,
                      creator.followerRange,
                    )}
                  </strong>
                  <span>Total followers</span>
                </div>
                <div className="brand-creator-stat">
                  <strong>{formatStatCount(creator.stats.avgViews)}</strong>
                  <span>Avg views</span>
                </div>
                <div className="brand-creator-stat">
                  <strong>
                    {formatStatPercent(creator.stats.avgEngagementRate)}
                  </strong>
                  <span>Avg engagement</span>
                </div>
                <div className="brand-creator-stat">
                  <strong>{creator.stats.completedCampaigns}</strong>
                  <span>Campaigns done</span>
                </div>
                <div className="brand-creator-stat">
                  <strong>{creator.stats.responseRate}%</strong>
                  <span>Response rate</span>
                </div>
              </div>
            </div>

            <div className="crm-detail-panel">
              <h3>By platform</h3>
              {creator.stats.platforms.filter((platform) => platform.followers > 0)
                .length === 0 ? (
                <p className="workspace-hint">
                  {creator.followerRange
                    ? `No per-platform counts yet. Range: ${creator.followerRange}.`
                    : "No platform stats yet."}
                </p>
              ) : (
                creator.stats.platforms
                  .filter((platform) => platform.followers > 0)
                  .map((platform) => (
                  <div key={platform.platform} style={{ marginBottom: 16 }}>
                    <strong>
                      {platform.platform}
                      {isConnectedPlatformSource(platform.source) && (
                        <span
                          className="marketplace-badge marketplace-badge--applied"
                          style={{ marginLeft: 8 }}
                        >
                          Connected
                        </span>
                      )}
                    </strong>
                    <div className="crm-meta-row">
                      <span>Followers</span>
                      <span>{formatCount(platform.followers)}</span>
                    </div>
                    {platform.avgViews > 0 && (
                      <div className="crm-meta-row">
                        <span>Avg views</span>
                        <span>{formatCount(platform.avgViews)}</span>
                      </div>
                    )}
                    {platform.engagementRate > 0 && (
                      <div className="crm-meta-row">
                        <span>Engagement</span>
                        <span>{formatPercent(platform.engagementRate)}</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </aside>
        </div>
      </div>
    </>
  );
}
