"use client";

import { RoleGuard } from "@/components/auth/RoleGuard";

export default function CampaignsLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allow={["brand"]}>{children}</RoleGuard>;
}

