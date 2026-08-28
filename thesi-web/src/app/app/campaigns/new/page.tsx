import { Suspense } from "react";
import { CampaignCreateContent } from "@/components/brand/campaigns/CampaignCreateContent";

export default function CampaignCreatePage() {
  return (
    <Suspense fallback={null}>
      <CampaignCreateContent />
    </Suspense>
  );
}
