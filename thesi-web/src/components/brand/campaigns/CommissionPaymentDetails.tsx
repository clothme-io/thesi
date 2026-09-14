import { commissionRulesText } from "@/lib/brand-campaigns/commission-rules";
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
      {payment?.affiliate?.rules && <p>{commissionRulesText(payment.affiliate.rules)}</p>}
      <p>{commissionSummary(payment)}</p>
      <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
        {commissionTerms(payment)}
      </p>
      <p className="workspace-hint">
        Commission varies with qualifying sales. Commission estimates require review.
        Commission payouts are not automated.
      </p>
    </div>
  );
}
