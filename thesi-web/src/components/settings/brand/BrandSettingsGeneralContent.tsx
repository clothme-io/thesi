"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthProvider";
import { BrandSettingsSection } from "./BrandSettingsSection";

export function BrandSettingsGeneralContent() {
  const { session } = useAuth();

  return (
    <BrandSettingsSection title="General" subtitle="Account and company identity">
      <section className="workspace-section">
        <h3>Account</h3>
        <div className="workspace-grid">
          <label className="workspace-field">
            <span>Account owner</span>
            <input type="text" value={session?.user.fullName ?? ""} readOnly />
          </label>
          <label className="workspace-field">
            <span>Work email</span>
            <input type="email" value={session?.user.email ?? ""} readOnly />
          </label>
          <label className="workspace-field">
            <span>Role</span>
            <input type="text" value="Brand" readOnly className="workspace-input-readonly" />
          </label>
        </div>
        <p className="workspace-hint">
          Company details and public brand info live on the{" "}
          <Link href="/app/profile" className="auth-link">
            Brand profile
          </Link>{" "}
          page.
        </p>
      </section>
    </BrandSettingsSection>
  );
}
