"use client";

import { CreatorDashboard } from "@/components/creator-crm/CreatorDashboard";
import { BrandDashboard } from "@/components/brand/BrandDashboard";
import { useAuth } from "@/context/AuthProvider";

export default function DashboardPage() {
  const { session } = useAuth();
  const isBrand = session?.user.role === "brand";

  if (isBrand) {
    return <BrandDashboard />;
  }

  return <CreatorDashboard />;
}
