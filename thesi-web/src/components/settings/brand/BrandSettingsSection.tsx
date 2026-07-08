"use client";

import type { ReactNode } from "react";

export function BrandSettingsSection({
  title,
  subtitle,
  saved,
  children,
}: {
  title: string;
  subtitle?: string;
  saved?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <header className="app-topbar">
        <div>
          <h1>{title}</h1>
          {subtitle && <span className="workspace-subtitle">{subtitle}</span>}
        </div>
        {saved && <span className="workspace-save-notice">Saved</span>}
      </header>
      <div className="app-content">{children}</div>
    </>
  );
}
