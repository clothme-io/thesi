"use client";

import { useAuth } from "@/context/AuthProvider";
import { BrandProfilePageContent } from "@/components/profile/BrandProfilePageContent";
import { CreatorProfilePageContent } from "@/components/profile/CreatorProfilePageContent";

export default function ProfilePage() {
  const { session } = useAuth();
  const isBrand = session?.user.role === "brand";

  if (isBrand) {
    return <BrandProfilePageContent />;
  }

  return <CreatorProfilePageContent />;
}
