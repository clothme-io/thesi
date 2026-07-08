"use client";

import { useAuth } from "@/context/AuthProvider";
import { BrandSettingsPageContent } from "@/components/settings/BrandSettingsPageContent";
import { CreatorSettingsPageContent } from "@/components/settings/CreatorSettingsPageContent";

export default function SettingsPage() {
  const { session } = useAuth();
  const isBrand = session?.user.role === "brand";

  if (isBrand) {
    return <BrandSettingsPageContent />;
  }

  return <CreatorSettingsPageContent />;
}
