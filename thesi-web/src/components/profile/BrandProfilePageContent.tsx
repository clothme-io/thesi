"use client";

import { useAuth } from "@/context/AuthProvider";
import { useBrandProfile } from "@/lib/profile/brand-storage";
import {
  BRAND_BUDGET_OPTIONS,
  BRAND_COMPANY_SIZE_OPTIONS,
  BRAND_GOAL_OPTIONS,
  BRAND_INDUSTRY_OPTIONS,
  BRAND_NICHE_OPTIONS,
  BRAND_PLATFORM_OPTIONS,
} from "@/lib/profile/brand-types";
import { getInitials } from "@/lib/profile/shared";

export function BrandProfilePageContent() {
  const { session, authenticatedRequest } = useAuth();
  const fallbackCompanyName = session?.user.companyName || session?.user.fullName || "";
  const {
    profile,
    ready,
    saved,
    saving,
    error,
    updateProfile,
    persistProfile,
  } = useBrandProfile(authenticatedRequest, fallbackCompanyName);

  if (!ready) return null;

  const toggleValue = (field: "preferredCreatorNiches" | "preferredPlatforms", value: string) => {
    const current = profile[field];
    const next = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
    updateProfile({ [field]: next });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await persistProfile(profile);
    } catch {
      // The hook exposes the user-facing error state.
    }
  };

  const displayName = profile.companyName || fallbackCompanyName;

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Brand profile</h1>
          <span className="workspace-subtitle">How creators see your company on Thesi</span>
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
          <div className="profile-avatar">{getInitials(displayName)}</div>
          <div>
            <h2>{displayName}</h2>
            <p>{profile.tagline || "Fashion & lifestyle brand"}</p>
            <span className="profile-role-badge">brand</span>
          </div>
        </div>

        <form className="workspace-form" onSubmit={handleSave}>
          <section className="workspace-section">
            <h3>Company</h3>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Brand / company name</span>
                <input
                  type="text"
                  value={profile.companyName}
                  onChange={(e) => updateProfile({ companyName: e.target.value })}
                  placeholder="Acme Fashion"
                />
              </label>
              <label className="workspace-field">
                <span>Tagline</span>
                <input
                  type="text"
                  value={profile.tagline}
                  onChange={(e) => updateProfile({ tagline: e.target.value })}
                  placeholder="Sustainable streetwear for Gen Z"
                />
              </label>
              <label className="workspace-field">
                <span>Industry</span>
                <select
                  value={profile.industry}
                  onChange={(e) => updateProfile({ industry: e.target.value })}
                >
                  <option value="">Select industry</option>
                  {BRAND_INDUSTRY_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-field">
                <span>Headquarters</span>
                <input
                  type="text"
                  value={profile.headquarters}
                  onChange={(e) => updateProfile({ headquarters: e.target.value })}
                  placeholder="Vancouver, BC"
                />
              </label>
              <label className="workspace-field workspace-field--full">
                <span>About the brand</span>
                <textarea
                  rows={4}
                  value={profile.about}
                  onChange={(e) => updateProfile({ about: e.target.value })}
                  placeholder="Share your brand story, audience, and what you look for in creator partnerships."
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
            <h3>Brand channels</h3>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Instagram</span>
                <input
                  type="text"
                  value={profile.instagram}
                  onChange={(e) => updateProfile({ instagram: e.target.value })}
                  placeholder="@brand"
                />
              </label>
              <label className="workspace-field">
                <span>TikTok</span>
                <input
                  type="text"
                  value={profile.tiktok}
                  onChange={(e) => updateProfile({ tiktok: e.target.value })}
                  placeholder="@brand"
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
                <span>LinkedIn</span>
                <input
                  type="url"
                  value={profile.linkedin}
                  onChange={(e) => updateProfile({ linkedin: e.target.value })}
                  placeholder="https://linkedin.com/company/..."
                />
              </label>
            </div>
          </section>

          <section className="workspace-section">
            <h3>Campaign preferences</h3>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Company size</span>
                <select
                  value={profile.companySize}
                  onChange={(e) => updateProfile({ companySize: e.target.value })}
                >
                  <option value="">Select team size</option>
                  {BRAND_COMPANY_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-field">
                <span>Typical campaign budget</span>
                <select
                  value={profile.typicalBudgetRange}
                  onChange={(e) => updateProfile({ typicalBudgetRange: e.target.value })}
                >
                  <option value="">Select budget range</option>
                  {BRAND_BUDGET_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="workspace-field workspace-field--full">
                <span>Primary goal on Thesi</span>
                <select
                  value={profile.primaryGoal}
                  onChange={(e) => updateProfile({ primaryGoal: e.target.value })}
                >
                  <option value="">Select goal</option>
                  {BRAND_GOAL_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="profile-niches">
              <span className="workspace-field-label">Preferred creator niches</span>
              <div className="profile-niche-list">
                {BRAND_NICHE_OPTIONS.map((niche) => (
                  <button
                    key={niche}
                    type="button"
                    className={`profile-niche ${profile.preferredCreatorNiches.includes(niche) ? "profile-niche--active" : ""}`}
                    onClick={() => toggleValue("preferredCreatorNiches", niche)}
                  >
                    {niche}
                  </button>
                ))}
              </div>
            </div>

            <div className="profile-niches">
              <span className="workspace-field-label">Primary content platforms</span>
              <div className="profile-niche-list">
                {BRAND_PLATFORM_OPTIONS.map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    className={`profile-niche ${profile.preferredPlatforms.includes(platform) ? "profile-niche--active" : ""}`}
                    onClick={() => toggleValue("preferredPlatforms", platform)}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <div className="workspace-form-footer">
            <button type="submit" className="crm-btn-primary" disabled={saving}>
              {saving ? "Saving…" : "Save brand profile"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
