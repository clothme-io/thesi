"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";

const CREATOR_NAV = [
  { href: "/app/dashboard", label: "Home", icon: "⌂" },
  { href: "/app/brands", label: "Brands", icon: "◎" },
  { href: "/app/pipeline", label: "Pipeline", icon: "▤" },
  { href: "/app/jobs", label: "Jobs", icon: "▣" },
  { href: "/app/contracts", label: "Contracts", icon: "📄" },
  { href: "/app/payments", label: "Payments", icon: "💳" },
  { href: "/app/calendar", label: "Calendar", icon: "📅" },
  { href: "/app/tasks", label: "Tasks", icon: "✓" },
  { href: "/app/inbox", label: "Inbox", icon: "✉" },
  { href: "/app/marketplace", label: "Marketplace", icon: "◆" },
  { href: "/app/profile", label: "Profile", icon: "◉" },
  { href: "/app/settings", label: "Settings", icon: "⚙" },
];

const BRAND_NAV = [
  { href: "/app/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/app/campaigns", label: "Campaigns", icon: "▣" },
  { href: "/app/marketplace", label: "Marketplace", icon: "◆" },
  { href: "/app/inbox", label: "Inbox", icon: "✉" },
  { href: "/app/profile", label: "Profile", icon: "◉" },
  { href: "/app/settings", label: "Settings", icon: "⚙" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const nav = session?.user.role === "brand" ? BRAND_NAV : CREATOR_NAV;

  return (
    <aside className={`app-sidebar ${collapsed ? "app-sidebar--collapsed" : ""}`}>
      <div className="app-sidebar-header">
        <img src="/clothme-logo.png" alt="" className="app-sidebar-logo" aria-hidden="true" />
        {!collapsed && (
          <div className="app-sidebar-user">
            <strong>Thesi</strong>
            <span>{session?.user.email}</span>
          </div>
        )}
      </div>

      <nav className="app-sidebar-nav" aria-label="Main">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`app-sidebar-link ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "app-sidebar-link--active" : ""}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="app-sidebar-icon" aria-hidden="true">
              {item.icon}
            </span>
            {!collapsed && <span>{item.label}</span>}
          </Link>
        ))}
      </nav>

      <div className="app-sidebar-footer">
        <button
          type="button"
          className="app-sidebar-toggle"
          onClick={() => setCollapsed((v) => !v)}
        >
          {collapsed ? "→" : "← Collapse"}
        </button>
        <button
          type="button"
          className="app-sidebar-signout"
          onClick={() => {
            signOut();
            router.push("/sign-in");
          }}
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
