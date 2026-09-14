"use client";

import { AppGuard } from "@/components/auth/AppGuard";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { WorkspacePermissionsProvider,WorkspaceRouteAccess } from '@/context/WorkspacePermissions';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppGuard>
      <WorkspacePermissionsProvider>
      <div className="app-shell">
        <AppSidebar />
        <div className="app-main"><WorkspaceRouteAccess>{children}</WorkspaceRouteAccess></div>
      </div>
      </WorkspacePermissionsProvider>
    </AppGuard>
  );
}
