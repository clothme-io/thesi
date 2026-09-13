"use client";

import type { HybridPaymentFormState } from "@/lib/brand-campaigns/payment-form";
import type {
  BrandCampaignHybridBaseTrigger,
  BrandCampaignHybridAffiliateType,
} from "@/lib/brand-campaigns/types";

export function CommissionPaymentBuilder({
  value,
  onChange,
}: {
  value: HybridPaymentFormState;
  onChange: (next: HybridPaymentFormState) => void;
}) {
  const set = <K extends keyof HybridPaymentFormState>(
    key: K,
    next: HybridPaymentFormState[K],
  ) => onChange({ ...value, [key]: next });

  return (
    <div className="workspace-field workspace-field--full">
      <div className="workspace-grid">
        <label className="workspace-field">
          <span>Base payment per creator (USD)</span>
          <input
            name="commissionBaseAmount"
            inputMode="decimal"
            placeholder="200.00"
            value={value.baseAmount}
            onChange={(e) => set("baseAmount", e.target.value)}
          />
        </label>
        <label className="workspace-field">
          <span>Base payment earned when</span>
          <select
            name="commissionBaseTrigger"
            value={value.baseTrigger}
            onChange={(e) =>
              set(
                "baseTrigger",
                e.target.value as BrandCampaignHybridBaseTrigger,
              )
            }
          >
            <option value="campaign_accepted">Campaign accepted</option>
            <option value="contract_signed">Contract signed</option>
            <option value="content_submitted">Content submitted</option>
            <option value="content_accepted">Content accepted</option>
            <option value="content_published">Content published</option>
            <option value="campaign_completed">Campaign completed</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {value.baseTrigger === "custom" && (
          <label className="workspace-field workspace-field--full">
            <span>Custom base payment trigger</span>
            <input
              name="commissionCustomTrigger"
              maxLength={160}
              value={value.baseCustomTrigger}
              onChange={(e) => set("baseCustomTrigger", e.target.value)}
            />
          </label>
        )}
        <label className="workspace-field">
          <span>Commission rate (%)</span>
          <input
            name="commissionRate"
            inputMode="decimal"
            placeholder="10"
            value={value.affiliatePercent}
            onChange={(e) => set("affiliatePercent", e.target.value)}
          />
        </label>
        <label className="workspace-field">
          <span>Commission calculated on</span>
          <select
            name="commissionBasis"
            value={value.affiliateType}
            onChange={(e) =>
              set(
                "affiliateType",
                e.target.value as BrandCampaignHybridAffiliateType,
              )
            }
          >
            <option value="" disabled>
              Select a commission base
            </option>
            <option value="percentage_of_sale">
              Eligible sales attributed to the creator
            </option>
            <option value="percentage_of_platform_commission">
              Platform commission from attributed sales
            </option>
          </select>
        </label>
        <label className="workspace-field">
          <span>Attribution window (days)</span>
          <input
            name="commissionAttributionDays"
            inputMode="numeric"
            value={value.affiliateAttributionDays}
            onChange={(e) => set("affiliateAttributionDays", e.target.value)}
          />
        </label>
        <label className="workspace-field workspace-field--full">
          <span>Commission eligibility and settlement terms</span>
          <textarea
            name="commissionTerms"
            rows={3}
            maxLength={2000}
            placeholder="Define eligible sales, discounts, taxes, shipping, refunds, attribution rules, and when commission is payable."
            value={value.affiliateTerms}
            onChange={(e) => set("affiliateTerms", e.target.value)}
          />
        </label>
      </div>
      <p className="workspace-hint">
        The base is a fixed amount per creator. Commission varies with
        qualifying sales. Platform commission means revenue the platform earns
        from those sales, not Thesi’s campaign service fee.
      </p>
      <p className="workspace-hint">
        These fields record the agreed terms. Sales tracking and commission
        payouts are not automated.
      </p>
    </div>
  );
}
