"use client";

import { useAuth } from "@/context/AuthProvider";
import { useCreatorProfile } from "@/lib/profile/creator-storage";
import { CREATOR_NICHE_OPTIONS } from "@/lib/profile/creator-types";
import { getInitials } from "@/lib/profile/shared";

export function CreatorProfilePageContent() {
  const { session } = useAuth();
  const fallbackName = session?.user.fullName ?? "";
  const { profile, ready, saved, updateProfile, persistProfile } = useCreatorProfile(fallbackName);

  if (!ready) return null;

  const toggleNiche = (niche: string) => {
    const niches = profile.niches.includes(niche)
      ? profile.niches.filter((n) => n !== niche)
      : [...profile.niches, niche];
    updateProfile({ niches });
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    persistProfile(profile);
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
        <div className="profile-hero">
          <div className="profile-avatar">{getInitials(profile.displayName || fallbackName)}</div>
          <div>
            <h2>{profile.displayName || fallbackName}</h2>
            <p>{profile.headline || "UGC Creator"}</p>
            <span className="profile-role-badge">creator</span>
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
                <span>TikTok</span>
                <input
                  type="text"
                  value={profile.tiktok}
                  onChange={(e) => updateProfile({ tiktok: e.target.value })}
                  placeholder="@handle"
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
                <span>Portfolio</span>
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
            <button type="submit" className="crm-btn-primary">
              Save profile
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
