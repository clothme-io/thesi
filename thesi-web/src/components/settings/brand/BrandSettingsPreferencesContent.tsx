"use client";

import { useAuth } from "@/context/AuthProvider";
import { useBrandSettings } from "@/lib/settings/brand-storage";
import { DATE_FORMAT_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/settings/shared-types";
import { SettingsToggle } from "../SettingsToggle";
import { BrandSettingsSection } from "./BrandSettingsSection";

export function BrandSettingsPreferencesContent() {
  const { authenticatedRequest } = useAuth();
  const {
    settings,
    ready,
    saved,
    saving,
    error,
    updateSettings,
    persistSettings,
  } = useBrandSettings(authenticatedRequest);

  if (!ready) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await persistSettings(settings);
    } catch {
      // The hook exposes the user-facing error state.
    }
  };

  return (
    <BrandSettingsSection title="Preferences" subtitle="Timezone and workspace display" saved={saved}>
      <form className="workspace-form" onSubmit={handleSave}>
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <section className="workspace-section">
          <div className="workspace-grid">
            <label className="workspace-field">
              <span>Timezone</span>
              <select
                value={settings.timezone}
                onChange={(e) => updateSettings({ timezone: e.target.value })}
              >
                {TIMEZONE_OPTIONS.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace("_", " ")}
                  </option>
                ))}
              </select>
            </label>
            <label className="workspace-field">
              <span>Date format</span>
              <select
                value={settings.dateFormat}
                onChange={(e) =>
                  updateSettings({ dateFormat: e.target.value as typeof settings.dateFormat })
                }
              >
                {DATE_FORMAT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="settings-toggle-list" style={{ marginTop: 16 }}>
            <SettingsToggle
              label="Compact sidebar"
              description="Start with the sidebar collapsed by default."
              checked={settings.compactSidebar}
              onChange={(v) => updateSettings({ compactSidebar: v })}
            />
          </div>
        </section>
        <div className="workspace-form-footer">
          <button type="submit" className="crm-btn-primary" disabled={saving}>
            {saving ? "Saving…" : "Save preferences"}
          </button>
        </div>
      </form>
    </BrandSettingsSection>
  );
}
