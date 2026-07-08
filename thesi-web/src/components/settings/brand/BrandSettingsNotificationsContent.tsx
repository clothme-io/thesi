"use client";

import { useBrandSettings } from "@/lib/settings/brand-storage";
import { SettingsToggle } from "../SettingsToggle";
import { BrandSettingsSection } from "./BrandSettingsSection";

export function BrandSettingsNotificationsContent() {
  const { settings, ready, saved, updateSettings, persistSettings } = useBrandSettings();

  if (!ready) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    persistSettings(settings);
  };

  return (
    <BrandSettingsSection title="Notifications" subtitle="Email and in-app alerts" saved={saved}>
      <form className="workspace-form" onSubmit={handleSave}>
        <section className="workspace-section">
          <div className="settings-toggle-list">
            <SettingsToggle
              label="Email notifications"
              description="Receive email alerts for important account activity."
              checked={settings.emailNotifications}
              onChange={(v) => updateSettings({ emailNotifications: v })}
            />
            <SettingsToggle
              label="Campaign updates"
              description="Get notified when campaigns are published, paused, or completed."
              checked={settings.campaignUpdates}
              onChange={(v) => updateSettings({ campaignUpdates: v })}
            />
            <SettingsToggle
              label="Creator applications"
              description="Alerts when creators respond to invites or apply to campaigns."
              checked={settings.creatorApplications}
              onChange={(v) => updateSettings({ creatorApplications: v })}
            />
            <SettingsToggle
              label="Payment reminders"
              description="Reminders for creator payouts and upcoming due dates."
              checked={settings.paymentReminders}
              onChange={(v) => updateSettings({ paymentReminders: v })}
            />
            <SettingsToggle
              label="Marketplace activity"
              description="Updates when marketplace listings get views or interest."
              checked={settings.marketplaceActivity}
              onChange={(v) => updateSettings({ marketplaceActivity: v })}
            />
            <SettingsToggle
              label="Marketing emails"
              description="Product updates, tips, and Thesi announcements."
              checked={settings.marketingEmails}
              onChange={(v) => updateSettings({ marketingEmails: v })}
            />
          </div>
        </section>
        <div className="workspace-form-footer">
          <button type="submit" className="crm-btn-primary">
            Save notifications
          </button>
        </div>
      </form>
    </BrandSettingsSection>
  );
}
