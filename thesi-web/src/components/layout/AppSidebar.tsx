"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/context/AuthProvider";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  match?: (path: string) => boolean;
};

const CREATOR_NAV: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: "⌂" },
  { href: CRM_ROUTES.brands, label: "CRM", icon: "◎", match: (path: string) => path.startsWith("/app/crm") },
  { href: "/app/inbox", label: "Inbox", icon: "✉" },
  { href: "/app/marketplace", label: "Marketplace", icon: "◆" },
  { href: "/app/profile", label: "Profile", icon: "◉" },
  { href: "/app/settings", label: "Settings", icon: "⚙" },
];

const BRAND_NAV: NavItem[] = [
  { href: "/app/dashboard", label: "Dashboard", icon: "⌂" },
  { href: "/app/campaigns", label: "Campaigns", icon: "▣" },
  { href: "/app/creators", label: "Creators", icon: "◈", match: (path: string) => path.startsWith("/app/creators") },
  { href: "/app/marketplace", label: "Marketplace", icon: "◆" },
  { href: "/app/inbox", label: "Inbox", icon: "✉" },
  { href: "/app/profile", label: "Brand profile", icon: "◉" },
  { href: "/app/settings", label: "Settings", icon: "⚙", match: (path: string) => path.startsWith("/app/settings") },
];

function isActive(pathname: string, href: string, match?: (path: string) => boolean) {
  if (match) return match(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}

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
            className={`app-sidebar-link ${isActive(pathname, item.href, item.match) ? "app-sidebar-link--active" : ""}`}
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
