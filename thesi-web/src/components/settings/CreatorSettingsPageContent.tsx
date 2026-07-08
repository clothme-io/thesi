"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { useCreatorSettings } from "@/lib/settings/creator-storage";
import { DATE_FORMAT_OPTIONS, TIMEZONE_OPTIONS } from "@/lib/settings/shared-types";
import { SettingsToggle } from "./SettingsToggle";

export function CreatorSettingsPageContent() {
  const { session } = useAuth();
  const { settings, ready, saved, updateSettings, persistSettings } = useCreatorSettings();

  if (!ready) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    persistSettings(settings);
  };

  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>Settings</h1>
          <span className="workspace-subtitle">Creator account and workspace preferences</span>
        </div>
        {saved && <span className="workspace-save-notice">Saved</span>}
      </header>

      <div className="app-content">
        <form className="workspace-form" onSubmit={handleSave}>
          <section className="workspace-section">
            <h3>Account</h3>
            <div className="workspace-grid">
              <label className="workspace-field">
                <span>Full name</span>
                <input type="text" value={session?.user.fullName ?? ""} readOnly />
              </label>
              <label className="workspace-field">
                <span>Email</span>
                <input type="email" value={session?.user.email ?? ""} readOnly />
              </label>
              <label className="workspace-field">
                <span>Role</span>
                <input type="text" value="Creator" readOnly className="workspace-input-readonly" />
              </label>
            </div>
            <p className="workspace-hint">Profile details live on the Profile page.</p>
          </section>

          <section className="workspace-section">
            <h3>Notifications</h3>
            <div className="settings-toggle-list">
              <SettingsToggle
                label="Email notifications"
                description="Receive email alerts for important account activity."
                checked={settings.emailNotifications}
                onChange={(v) => updateSettings({ emailNotifications: v })}
              />
              <SettingsToggle
                label="Deal updates"
                description="Get notified when deals move stages or need follow-up."
                checked={settings.dealUpdates}
                onChange={(v) => updateSettings({ dealUpdates: v })}
              />
              <SettingsToggle
                label="Payment reminders"
                description="Reminders for overdue invoices and upcoming due dates."
                checked={settings.paymentReminders}
                onChange={(v) => updateSettings({ paymentReminders: v })}
              />
              <SettingsToggle
                label="Task reminders"
                description="Daily summary of tasks due today."
                checked={settings.taskReminders}
                onChange={(v) => updateSettings({ taskReminders: v })}
              />
              <SettingsToggle
                label="Marketing emails"
                description="Product updates, tips, and Thesi announcements."
                checked={settings.marketingEmails}
                onChange={(v) => updateSettings({ marketingEmails: v })}
              />
            </div>
          </section>

          <section className="workspace-section">
            <h3>Security</h3>
            <div className="settings-security">
              <div>
                <strong>Password</strong>
                <p>Update your password to keep your account secure.</p>
              </div>
              <Link href="/onboarding/change-password" className="crm-btn-secondary">
                Change password
              </Link>
            </div>
          </section>

          <section className="workspace-section">
            <h3>Preferences</h3>
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
            <button type="submit" className="crm-btn-primary">
              Save settings
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
