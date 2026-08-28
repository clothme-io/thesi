import { Suspense } from "react";
import { CreatorSocialAccountsContent } from "@/components/settings/CreatorSocialAccountsContent";

export default function CreatorSocialSettingsPage() {
  return (
    <Suspense fallback={null}>
      <CreatorSocialAccountsContent />
    </Suspense>
  );
}
