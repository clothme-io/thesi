"use client";

import { AppGuard } from "@/components/auth/AppGuard";
import { AppSidebar } from "@/components/layout/AppSidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppGuard>
      <div className="app-shell">
        <AppSidebar />
        <div className="app-main">{children}</div>
      </div>
    </AppGuard>
  );
}
