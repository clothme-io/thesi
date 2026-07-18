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
import { formatCount, formatPercent } from "@/lib/creators/types";

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

  return (
    <>
      <header className="app-topbar">
        <div>
          <Link href={BRAND_CREATORS_ROUTES.list} className="auth-link" style={{ fontSize: 13 }}>
            ← Creators
          </Link>
          <h1 style={{ marginTop: 4 }}>{creator.name}</h1>
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
                <p className="workspace-hint">No UGC posts on file yet.</p>
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
                            <strong>{post.title}</strong>
                            {post.brandName && (
                              <span className="brand-ugc-brand" style={{ display: "block" }}>
                                {post.brandName}
                              </span>
                            )}
                          </td>
                          <td>{post.platform}</td>
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
              <div className="brand-creator-stats-grid">
                <div className="brand-creator-stat">
                  <strong>{formatCount(creator.stats.totalFollowers)}</strong>
                  <span>Total followers</span>
                </div>
                <div className="brand-creator-stat">
                  <strong>{formatCount(creator.stats.avgViews)}</strong>
                  <span>Avg views</span>
                </div>
                <div className="brand-creator-stat">
                  <strong>{formatPercent(creator.stats.avgEngagementRate)}</strong>
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
              {creator.stats.platforms.length === 0 ? (
                <p className="workspace-hint">No platform stats yet.</p>
              ) : (
                creator.stats.platforms.map((platform) => (
                  <div key={platform.platform} style={{ marginBottom: 16 }}>
                    <strong>{platform.platform}</strong>
                    <div className="crm-meta-row">
                      <span>Followers</span>
                      <span>{formatCount(platform.followers)}</span>
                    </div>
                    <div className="crm-meta-row">
                      <span>Avg views</span>
                      <span>{formatCount(platform.avgViews)}</span>
                    </div>
                    <div className="crm-meta-row">
                      <span>Engagement</span>
                      <span>{formatPercent(platform.engagementRate)}</span>
                    </div>
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
