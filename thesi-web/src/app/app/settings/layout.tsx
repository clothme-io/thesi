"use client";

import { useAuth } from "@/context/AuthProvider";
import { BrandSettingsSubnav } from "@/components/layout/BrandSettingsSubnav";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const { session } = useAuth();
  const isBrand = session?.user.role === "brand";

  if (!isBrand) {
    return <>{children}</>;
  }

  return (
    <div className="crm-shell">
      <BrandSettingsSubnav />
      <div className="crm-main">{children}</div>
    </div>
  );
}
