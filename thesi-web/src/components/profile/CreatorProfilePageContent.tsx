"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorProfile } from "@/lib/profile/creator-storage";
import {
  CREATOR_FOLLOWER_RANGE_OPTIONS,
  CREATOR_NICHE_OPTIONS,
} from "@/lib/profile/creator-types";
import { getInitials } from "@/lib/profile/shared";
import { CreatorPortfolioBuilder } from "./CreatorPortfolioBuilder";

export function CreatorProfilePageContent() {
  const { session, authenticatedRequest } = useAuth();
  const fallbackName = session?.user.fullName ?? "";
  const {
    profile,
    ready,
    saved,
    saving,
    error,
    updateProfile,
    persistProfile,
    uploadProfileImage,
  } = useCreatorProfile(authenticatedRequest, fallbackName);

  if (!ready) return null;

  const toggleNiche = (niche: string) => {
    const niches = profile.niches.includes(niche)
      ? profile.niches.filter((n) => n !== niche)
      : [...profile.niches, niche];
    updateProfile({ niches });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await persistProfile(profile);
    } catch {
      // The hook exposes the user-facing error state.
    }
  };

  const handleProfileImageChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadProfileImage(file);
    } catch {
      // The hook exposes the user-facing error state.
    } finally {
      e.target.value = "";
    }
  };

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Profile</h1>
          <span className="workspace-subtitle">Your public creator profile</span>
        </div>
        {saved && <span className="workspace-save-notice">Saved</span>}
      </header>

      <div className="app-content">
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="profile-hero">
          {profile.profileImageUrl ? (
            <div
              className="profile-avatar profile-avatar--image"
              style={{ backgroundImage: `url("${profile.profileImageUrl}")` }}
              aria-label={`${profile.displayName || fallbackName} profile image`}
              role="img"
            />
          ) : (
            <div className="profile-avatar">
              {getInitials(profile.displayName || fallbackName)}
            </div>
          )}
          <div>
            <h2>{profile.displayName || fallbackName}</h2>
            <p>{profile.headline || "UGC Creator"}</p>
            <div className="profile-hero-actions">
              <span className="profile-role-badge">creator</span>
              <label className="profile-image-upload">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handleProfileImageChange}
                  disabled={saving}
                />
                {profile.profileImageUrl ? "Change photo" : "Add photo"}
              </label>
            </div>
          </div>
        </div>

        <form className="workspace-form" onSubmit={handleSave}>
          <section className="workspace-section">
            <h3>About you</h3>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Display name</span>
                <input
                  type="text"
                  value={profile.displayName}
                  onChange={(e) => updateProfile({ displayName: e.target.value })}
                />
              </label>
              <label className="workspace-field">
                <span>Headline</span>
                <input
                  type="text"
                  value={profile.headline}
                  onChange={(e) => updateProfile({ headline: e.target.value })}
                  placeholder="Fashion & lifestyle UGC creator"
                />
              </label>
              <label className="workspace-field workspace-field--full">
                <span>Bio</span>
                <textarea
                  rows={4}
                  value={profile.bio}
                  onChange={(e) => updateProfile({ bio: e.target.value })}
                  placeholder="Tell brands about your style, audience, and experience."
                />
              </label>
              <label className="workspace-field">
                <span>Location</span>
                <input
                  type="text"
                  value={profile.location}
                  onChange={(e) => updateProfile({ location: e.target.value })}
                  placeholder="Los Angeles, CA"
                />
              </label>
              <label className="workspace-field">
                <span>Website</span>
                <input
                  type="url"
                  value={profile.website}
                  onChange={(e) => updateProfile({ website: e.target.value })}
                  placeholder="https://"
                />
              </label>
            </div>
          </section>

          <section className="workspace-section">
            <h3>Social links</h3>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Instagram</span>
                <input
                  type="text"
                  value={profile.instagram}
                  onChange={(e) => updateProfile({ instagram: e.target.value })}
                  placeholder="@handle"
                />
              </label>
              <label className="workspace-field">
                <span>Instagram followers</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={
                    profile.instagramFollowers
                      ? String(profile.instagramFollowers)
                      : ""
                  }
                  onChange={(e) =>
                    updateProfile({
                      instagramFollowers:
                        Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                    })
                  }
                />
              </label>
              <label className="workspace-field">
                <span>TikTok</span>
                <input
                  type="text"
                  value={profile.tiktok}
                  onChange={(e) => updateProfile({ tiktok: e.target.value })}
                  placeholder="@handle"
                />
              </label>
              <label className="workspace-field">
                <span>TikTok followers</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={
                    profile.tiktokFollowers ? String(profile.tiktokFollowers) : ""
                  }
                  onChange={(e) =>
                    updateProfile({
                      tiktokFollowers:
                        Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                    })
                  }
                />
              </label>
              <label className="workspace-field">
                <span>YouTube</span>
                <input
                  type="text"
                  value={profile.youtube}
                  onChange={(e) => updateProfile({ youtube: e.target.value })}
                  placeholder="Channel URL"
                />
              </label>
              <label className="workspace-field">
                <span>YouTube subscribers</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={
                    profile.youtubeFollowers
                      ? String(profile.youtubeFollowers)
                      : ""
                  }
                  onChange={(e) =>
                    updateProfile({
                      youtubeFollowers:
                        Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                    })
                  }
                />
              </label>
              <label className="workspace-field workspace-field--full">
                <span>Portfolio site</span>
                <input
                  type="url"
                  value={profile.portfolioUrl}
                  onChange={(e) => updateProfile({ portfolioUrl: e.target.value })}
                  placeholder="https://"
                />
              </label>
            </div>
          </section>

          <section className="workspace-section">
            <h3>Audience</h3>
            <p className="workspace-hint" style={{ marginTop: 0 }}>
              Brands see these numbers until you{" "}
              <Link href="/app/settings/social" className="auth-link">
                connect social accounts
              </Link>
              . Range is enough if you do not have exact counts yet.
            </p>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Follower range</span>
                <select
                  value={profile.followerRange}
                  onChange={(e) => updateProfile({ followerRange: e.target.value })}
                >
                  {CREATOR_FOLLOWER_RANGE_OPTIONS.map((option) => (
                    <option key={option.value || "none"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-field">
                <span>Typical views</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={profile.avgViews ? String(profile.avgViews) : ""}
                  onChange={(e) =>
                    updateProfile({
                      avgViews: Number(e.target.value.replace(/[^0-9]/g, "")) || 0,
                    })
                  }
                />
              </label>
              <label className="workspace-field">
                <span>Engagement %</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={
                    profile.avgEngagementRate
                      ? String(profile.avgEngagementRate)
                      : ""
                  }
                  onChange={(e) =>
                    updateProfile({
                      avgEngagementRate:
                        Number(e.target.value.replace(/[^0-9.]/g, "")) || 0,
                    })
                  }
                />
              </label>
              <CreatorPortfolioBuilder
                posts={profile.ugcPosts}
                onChange={(ugcPosts) => updateProfile({ ugcPosts })}
              />
            </div>
          </section>

          <section className="workspace-section">
            <h3>Business details</h3>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Rate range</span>
                <input
                  type="text"
                  value={profile.rateRange}
                  onChange={(e) => updateProfile({ rateRange: e.target.value })}
                  placeholder="$500 – $2,500 per project"
                />
              </label>
              <label className="workspace-field">
                <span>Typical turnaround</span>
                <input
                  type="text"
                  value={profile.turnaround}
                  onChange={(e) => updateProfile({ turnaround: e.target.value })}
                />
              </label>
            </div>

            <div className="profile-niches">
              <span className="workspace-field-label">Content niches</span>
              <div className="profile-niche-list">
                {CREATOR_NICHE_OPTIONS.map((niche) => (
                  <button
                    key={niche}
                    type="button"
                    className={`profile-niche ${profile.niches.includes(niche) ? "profile-niche--active" : ""}`}
                    onClick={() => toggleNiche(niche)}
                  >
                    {niche}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="workspace-form-footer">
            <button type="submit" className="crm-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save profile"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
