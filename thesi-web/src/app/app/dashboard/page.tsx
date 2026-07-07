"use client";

import { CreatorDashboard } from "@/components/creator-crm/CreatorDashboard";
import { useAuth } from "@/context/AuthProvider";

export default function DashboardPage() {
  const { session } = useAuth();
  const isBrand = session?.user.role === "brand";

  if (isBrand) {
    return (
      <>
        <header className="app-topbar">
          <h1>Dashboard</h1>
          <span style={{ color: "var(--muted)", fontSize: 14 }}>Brand workspace</span>
        </header>
        <div className="app-content">
          <div className="app-panel">
            <h2>Welcome, {session?.user.fullName}</h2>
            <p>Campaign management and creator invites will appear here.</p>
          </div>
        </div>
      </>
    );
  }

  return <CreatorDashboard />;
}
