"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthProvider";
import { CreatorSettingsPageContent } from "@/components/settings/CreatorSettingsPageContent";
import { BRAND_SETTINGS_ROUTES } from "@/lib/settings/brand-routes";

export default function SettingsPage() {
  const router = useRouter();
  const { session, isLoading } = useAuth();
  const isBrand = session?.user.role === "brand";

  useEffect(() => {
    if (!isLoading && isBrand) {
      router.replace(BRAND_SETTINGS_ROUTES.general);
    }
  }, [isLoading, isBrand, router]);

  if (isLoading || isBrand) return null;

  return <CreatorSettingsPageContent />;
}
