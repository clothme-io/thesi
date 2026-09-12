import type { BrandCampaignHybridPayment } from "@/lib/brand-campaigns/types";
import {
  commissionSummary,
  commissionTerms,
} from "@/lib/brand-campaigns/commission";

export function CommissionPaymentDetails({
  payment,
}: {
  payment?: BrandCampaignHybridPayment;
}) {
  return (
    <div>
      <p>{commissionSummary(payment)}</p>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {commissionTerms(payment)}
      </p>
      <p className="workspace-hint">
        Commission varies with qualifying sales. Sales tracking and commission
        payouts are not automated.
      </p>
    </div>
  );
}
