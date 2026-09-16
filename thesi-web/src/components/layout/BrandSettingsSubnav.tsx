"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { BRAND_SETTINGS_ROUTES } from "@/lib/settings/brand-routes";
import { useWorkspacePermissions } from '@/context/WorkspacePermissions';

const BRAND_SETTINGS_NAV = [
  { href: BRAND_SETTINGS_ROUTES.integrations, label: "Merchant Hub", match: (path: string) => path.startsWith(BRAND_SETTINGS_ROUTES.integrations) },
  {
    href: BRAND_SETTINGS_ROUTES.general,
    label: "General",
    match: (path: string) =>
      path === BRAND_SETTINGS_ROUTES.general || path === BRAND_SETTINGS_ROUTES.root,
  },
  {
    href: BRAND_SETTINGS_ROUTES.notifications,
    label: "Notifications",
    match: (path: string) => path.startsWith(BRAND_SETTINGS_ROUTES.notifications),
  },
  {
    href: BRAND_SETTINGS_ROUTES.billing,
    label: "Billing",
    match: (path: string) => path.startsWith(BRAND_SETTINGS_ROUTES.billing),
  },
  {
    href: BRAND_SETTINGS_ROUTES.paymentMethods,
    label: "Payment methods",
    match: (path: string) => path.startsWith(BRAND_SETTINGS_ROUTES.paymentMethods),
  },
  {
    href: BRAND_SETTINGS_ROUTES.paymentHistory,
    label: "Payment history",
    match: (path: string) => path.startsWith(BRAND_SETTINGS_ROUTES.paymentHistory),
  },
  {
    href: BRAND_SETTINGS_ROUTES.security,
    label: "Security",
    match: (path: string) => path.startsWith(BRAND_SETTINGS_ROUTES.security),
  },
  {
    href: BRAND_SETTINGS_ROUTES.preferences,
    label: "Preferences",
    match: (path: string) => path.startsWith(BRAND_SETTINGS_ROUTES.preferences),
  },
];

export function BrandSettingsSubnav() {
  const pathname = usePathname();
  const {canManageFunds}=useWorkspacePermissions();
  const listRef = useRef<HTMLElement>(null);

  useEffect(() => {
    listRef.current
      ?.querySelector(".crm-subnav-link--active")
      ?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [pathname]);

  return (
    <aside className="crm-subnav" aria-label="Settings">
      <div className="crm-subnav-header">Settings</div>
      <nav className="crm-subnav-list" ref={listRef}>
        {BRAND_SETTINGS_NAV.filter(item=>canManageFunds||!['Merchant Hub','Billing','Payment methods','Payment history'].includes(item.label)).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`crm-subnav-link ${item.match(pathname) ? "crm-subnav-link--active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
