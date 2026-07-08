"use client";

import { RoleGuard } from "@/components/auth/RoleGuard";

export default function BrandCreatorsLayout({ children }: { children: React.ReactNode }) {
  return <RoleGuard allow={["brand"]}>{children}</RoleGuard>;
}
