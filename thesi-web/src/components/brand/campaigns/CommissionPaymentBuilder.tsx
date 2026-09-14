"use client";

import type { HybridPaymentFormState } from "@/lib/brand-campaigns/payment-form";
import type { BrandCampaignHybridAffiliateType } from "@/lib/brand-campaigns/types";

export function CommissionPaymentBuilder({
  value,
  onChange,
  creatorCapacity,
}: {
  value: HybridPaymentFormState;
  creatorCapacity?: string;
  onChange: (next: HybridPaymentFormState) => void;
}) {
  const set = <K extends keyof HybridPaymentFormState>(
    key: K,
    next: HybridPaymentFormState[K],
  ) => onChange({ ...value, [key]: next });

  return (
    <div className="workspace-field workspace-field--full">
      <label className="workspace-field">
        <span>
          <input
            type="checkbox"
            checked={value.baseEnabled}
            onChange={(e) => set("baseEnabled", e.target.checked)}
          />{" "}
          Include a fixed base payment (optional)
        </span>
      </label>
      <div className="workspace-grid">
        {value.baseEnabled && (
          <>
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
            <p className="workspace-hint">
              ClothME releases this base payment after you accept the creator’s
              work.
            </p>
          </>
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
      {value.commissionRules && (
        <fieldset className="workspace-field">
          <legend>Commission payout rules</legend>
          <div className="workspace-grid">
            <label className="workspace-field">
              <span>Sale review period (days)</span>
              <input
                type="number"
                name="commissionReviewDays"
                min="0"
                max="365"
                value={value.commissionRules.reviewDays}
                onChange={(e) =>
                  set("commissionRules", {
                    ...value.commissionRules!,
                    reviewDays: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="workspace-field">
              <span>Payout eligibility schedule</span>
              <select
                name="commissionPayoutFrequency"
                value={value.commissionRules.payoutFrequency}
                onChange={(e) =>
                  set("commissionRules", {
                    ...value.commissionRules!,
                    payoutFrequency: e.target.value as
                      "on_approval" | "weekly" | "monthly",
                  })
                }
              >
                <option value="on_approval">After review and approval</option>
                <option value="weekly">Next Monday after review (UTC)</option>
                <option value="monthly">
                  Next month start after review (UTC)
                </option>
              </select>
            </label>
            <label className="workspace-field">
              <span>Minimum individual commission payout (USD)</span>
              <input
                type="number"
                name="commissionMinimumPayout"
                min="0"
                step="0.01"
                value={value.commissionRules.minimumPayoutCents / 100}
                onChange={(e) =>
                  set("commissionRules", {
                    ...value.commissionRules!,
                    minimumPayoutCents: Math.round(
                      Number(e.target.value) * 100,
                    ),
                  })
                }
              />
            </label>
          </div>
          <p className="workspace-hint">
            No extra creator payout fee. Credit-funded sales require funding
            verification. Suspected self-referrals and fraud require ClothME
            review. Every payout requires approval. This schedule sets the
            earliest approval date; automatic batches and combining small
            balances are not available here. A positive minimum blocks smaller
            individual payouts.
          </p>
        </fieldset>
      )}
      <p className="workspace-hint">
        {value.baseEnabled
          ? `Base deposit before launch: ${Number(creatorCapacity) > 0 && Number(value.baseAmount) > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Math.round(Number(value.baseAmount) * 100) * Number(creatorCapacity)) / 100) : "set a base amount and creator slots"}. Base per creator × creator slots. ClothME holds the deposit, releases each creator’s base after your acceptance of their work, and returns unused slot funds when you close the campaign.`
          : "No deposit is required. Qualifying sales fund creator commission."}{" "}
        ClothME handles payouts. Commission is funded from sales, including when
        a base is enabled.
      </p>
      <p className="workspace-hint">
        The optional base is a fixed amount per creator. Commission varies with
        qualifying sales. Platform commission means revenue the platform earns
        from those sales, not Thesi’s campaign service fee.
      </p>
      <p className="workspace-hint">
        These fields record the agreed terms. Commission estimates require
        review. Commission payouts are not automated.
      </p>
    </div>
  );
}
