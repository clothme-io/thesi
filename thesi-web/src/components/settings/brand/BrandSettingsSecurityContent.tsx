"use client";

import Link from "next/link";
import { BrandSettingsSection } from "./BrandSettingsSection";

export function BrandSettingsSecurityContent() {
  return (
    <BrandSettingsSection title="Security" subtitle="Password and account access">
      <section className="workspace-section">
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
    </BrandSettingsSection>
  );
}
