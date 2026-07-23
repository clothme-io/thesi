"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CRM_ROUTES } from "@/lib/creator-crm/routes";

const CRM_NAV = [
  { href: CRM_ROUTES.brands, label: "Brands", match: (path: string) => path.startsWith(CRM_ROUTES.brands) },
  { href: CRM_ROUTES.pipeline, label: "Pipeline", match: (path: string) => path.startsWith(CRM_ROUTES.pipeline) },
  { href: CRM_ROUTES.jobs, label: "Jobs", match: (path: string) => path.startsWith(CRM_ROUTES.jobs) },
  { href: CRM_ROUTES.contracts, label: "Contracts", match: (path: string) => path.startsWith(CRM_ROUTES.contracts) },
  { href: CRM_ROUTES.payments, label: "Payments", match: (path: string) => path.startsWith(CRM_ROUTES.payments) },
  { href: CRM_ROUTES.invoices, label: "Invoices", match: (path: string) => path.startsWith(CRM_ROUTES.invoices) },
  { href: CRM_ROUTES.calendar, label: "Calendar", match: (path: string) => path.startsWith(CRM_ROUTES.calendar) },
  { href: CRM_ROUTES.tasks, label: "Tasks", match: (path: string) => path.startsWith(CRM_ROUTES.tasks) },
  { href: CRM_ROUTES.objects, label: "Objects", match: (path: string) => path.startsWith(CRM_ROUTES.objects) },
  { href: CRM_ROUTES.dataModel, label: "Data model", match: (path: string) => path.startsWith(CRM_ROUTES.dataModel) },
  { href: CRM_ROUTES.workflows, label: "Workflows", match: (path: string) => path.startsWith(CRM_ROUTES.workflows) },
];

export function CrmSubnav() {
  const pathname = usePathname();

  return (
    <aside className="crm-subnav" aria-label="CRM">
      <div className="crm-subnav-header">CRM</div>
      <nav className="crm-subnav-list">
        {CRM_NAV.map((item) => (
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
