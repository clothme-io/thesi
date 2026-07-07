"use client";

import { useAuth } from "@/context/AuthProvider";

export default function DashboardPage() {
  const { session } = useAuth();
  const isBrand = session?.user.role === "brand";

  return (
    <>
      <header className="app-topbar">
        <h1>Dashboard</h1>
        <span style={{ color: "var(--muted)", fontSize: 14 }}>
          {isBrand ? "Brand workspace" : "Creator workspace"}
        </span>
      </header>

      <div className="app-content">
        <div className="app-dashboard-grid">
          <div className="app-stat-card">
            <span>{isBrand ? "Active campaigns" : "Active campaigns"}</span>
            <strong>0</strong>
          </div>
          <div className="app-stat-card">
            <span>{isBrand ? "Creators engaged" : "Pending invitations"}</span>
            <strong>0</strong>
          </div>
          <div className="app-stat-card">
            <span>{isBrand ? "Marketplace views" : "CRM contacts"}</span>
            <strong>0</strong>
          </div>
          <div className="app-stat-card">
            <span>Unread messages</span>
            <strong>0</strong>
          </div>
        </div>

        <div className="app-panel">
          <h2>Welcome, {session?.user.fullName}</h2>
          <p>
            {isBrand
              ? "Campaign management, creator invites, and marketplace posting will appear here in the next phase."
              : "Your CRM, campaign inbox, and invoice tools will appear here as we continue building Thesi."}
          </p>
        </div>
      </div>
    </>
  );
}
