"use client";

import type {
  BrandCampaignHybridAffiliateType,
  BrandCampaignHybridBaseTrigger,
  BrandCampaignHybridMetric,
  BrandCampaignHybridMilestoneAmountType,
  BrandCampaignHybridPoolDistribution,
  BrandCampaignHybridPoolSettlement,
  BrandCampaignMilestoneStructure,
} from "@/lib/brand-campaigns/types";
import {
  defaultHybridMilestoneRows,
  defaultHybridPoolMetrics,
  newMilestoneId,
  type HybridPaymentFormState,
} from "@/lib/brand-campaigns/payment-form";
import { MilestoneBuilder } from "./MilestoneBuilder";

const BASE_TRIGGER_OPTIONS: Array<{ label: string; value: BrandCampaignHybridBaseTrigger }> = [
  { label: "Campaign accepted", value: "campaign_accepted" },
  { label: "Contract signed", value: "contract_signed" },
  { label: "Content submitted", value: "content_submitted" },
  { label: "Content accepted", value: "content_accepted" },
  { label: "Content published", value: "content_published" },
  { label: "Campaign completed", value: "campaign_completed" },
  { label: "Custom", value: "custom" },
];

const METRIC_OPTIONS: Array<{ label: string; value: BrandCampaignHybridMetric }> = [
  { label: "Views", value: "views" },
  { label: "Qualified signups", value: "qualified_signups" },
  { label: "Account creations", value: "account_creations" },
  { label: "Fit profiles completed", value: "fit_profiles_completed" },
  { label: "Purchases", value: "purchases" },
  { label: "Sales revenue", value: "sales_revenue" },
  { label: "Engagement", value: "engagement" },
  { label: "Clicks", value: "clicks" },
  { label: "Custom", value: "custom" },
];

const MILESTONE_STRUCTURE_OPTIONS: Array<{ label: string; value: BrandCampaignMilestoneStructure }> = [
  { label: "Cumulative milestones", value: "cumulative" },
  { label: "Highest milestone achieved", value: "highest_achieved" },
];

const AMOUNT_TYPE_OPTIONS: Array<{ label: string; value: BrandCampaignHybridMilestoneAmountType }> = [
  { label: "Amounts are total compensation", value: "total_compensation" },
  { label: "Amounts are bonuses on top of base", value: "bonus_in_addition_to_base" },
];

const AFFILIATE_TYPE_OPTIONS: Array<{ label: string; value: BrandCampaignHybridAffiliateType }> = [
  { label: "Percentage of sale", value: "percentage_of_sale" },
  { label: "Percentage of platform commission", value: "percentage_of_platform_commission" },
  { label: "Fixed amount per sale", value: "fixed_amount_per_sale" },
];

const POOL_DISTRIBUTION_OPTIONS: Array<{ label: string; value: BrandCampaignHybridPoolDistribution }> = [
  { label: "Impact Score", value: "impact_score" },
  { label: "Proportional performance", value: "proportional_performance" },
  { label: "Equal distribution", value: "equal_distribution" },
  { label: "Manual review", value: "manual" },
  { label: "Custom", value: "custom" },
];

const POOL_SETTLEMENT_OPTIONS: Array<{ label: string; value: BrandCampaignHybridPoolSettlement }> = [
  { label: "At campaign end", value: "campaign_end" },
  { label: "Days after campaign end", value: "days_after_campaign_end" },
  { label: "Manual", value: "manual" },
];

type Props = {
  value: HybridPaymentFormState;
  onChange: (next: HybridPaymentFormState) => void;
};

export function HybridPaymentBuilder({ value, onChange }: Props) {
  const set = <K extends keyof HybridPaymentFormState>(
    key: K,
    next: HybridPaymentFormState[K],
  ) => onChange({ ...value, [key]: next });

  return (
    <div className="workspace-field workspace-field--full">
      <span>Hybrid compensation structure</span>
      <div style={{ display: "grid", gap: 16, marginTop: 10 }}>
        <section className="workspace-section" style={{ margin: 0 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={value.baseEnabled}
              onChange={() => set("baseEnabled", !value.baseEnabled)}
            />
            <strong>Base compensation</strong>
          </label>
          {value.baseEnabled && (
            <div className="workspace-grid" style={{ marginTop: 12 }}>
              <label className="workspace-field">
                <span>Amount</span>
                <input
                  type="text"
                  placeholder="$0.00"
                  value={value.baseAmount}
                  onChange={(e) => set("baseAmount", e.target.value)}
                />
              </label>
              <label className="workspace-field">
                <span>Paid when</span>
                <select
                  value={value.baseTrigger}
                  onChange={(e) =>
                    set("baseTrigger", e.target.value as BrandCampaignHybridBaseTrigger)
                  }
                >
                  {BASE_TRIGGER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {value.baseTrigger === "custom" && (
                <label className="workspace-field workspace-field--full">
                  <span>Custom base trigger</span>
                  <input
                    type="text"
                    value={value.baseCustomTrigger}
                    onChange={(e) => set("baseCustomTrigger", e.target.value)}
                  />
                </label>
              )}
            </div>
          )}
        </section>

        <section className="workspace-section" style={{ margin: 0 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={value.milestonesEnabled}
              onChange={() =>
                onChange({
                  ...value,
                  milestonesEnabled: !value.milestonesEnabled,
                  milestoneRows:
                    value.milestoneRows.length > 0
                      ? value.milestoneRows
                      : defaultHybridMilestoneRows(),
                })
              }
            />
            <strong>Performance milestones</strong>
          </label>
          {value.milestonesEnabled && (
            <div className="workspace-grid" style={{ marginTop: 12 }}>
              <label className="workspace-field">
                <span>Measured metric</span>
                <select
                  value={value.milestoneMetric}
                  onChange={(e) =>
                    set("milestoneMetric", e.target.value as BrandCampaignHybridMetric)
                  }
                >
                  {METRIC_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="workspace-field">
                <span>Amount meaning</span>
                <select
                  value={value.milestoneAmountType}
                  onChange={(e) =>
                    set("milestoneAmountType", e.target.value as BrandCampaignHybridMilestoneAmountType)
                  }
                >
                  {AMOUNT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {value.milestoneMetric === "custom" && (
                <label className="workspace-field workspace-field--full">
                  <span>Custom metric</span>
                  <input
                    type="text"
                    value={value.milestoneCustomMetric}
                    onChange={(e) => set("milestoneCustomMetric", e.target.value)}
                  />
                </label>
              )}
              <div className="workspace-field workspace-field--full">
                <span>Milestone structure</span>
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {MILESTONE_STRUCTURE_OPTIONS.map((option) => (
                    <label key={option.value} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="radio"
                        name="hybridMilestoneStructure"
                        value={option.value}
                        checked={value.milestoneStructure === option.value}
                        onChange={() => set("milestoneStructure", option.value)}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
              <MilestoneBuilder
                rows={value.milestoneRows}
                onChange={(rows) => set("milestoneRows", rows)}
              />
            </div>
          )}
        </section>

        <section className="workspace-section" style={{ margin: 0 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={value.affiliateEnabled}
              onChange={() => set("affiliateEnabled", !value.affiliateEnabled)}
            />
            <strong>Affiliate commission</strong>
          </label>
          {value.affiliateEnabled && (
            <div className="workspace-grid" style={{ marginTop: 12 }}>
              <label className="workspace-field">
                <span>Commission type</span>
                <select
                  value={value.affiliateType}
                  onChange={(e) =>
                    set("affiliateType", e.target.value as BrandCampaignHybridAffiliateType)
                  }
                >
                  {AFFILIATE_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {value.affiliateType === "fixed_amount_per_sale" ? (
                <label className="workspace-field">
                  <span>Fixed amount</span>
                  <input
                    type="text"
                    placeholder="$0.00"
                    value={value.affiliateFixedAmount}
                    onChange={(e) => set("affiliateFixedAmount", e.target.value)}
                  />
                </label>
              ) : (
                <label className="workspace-field">
                  <span>Commission percent</span>
                  <input
                    type="text"
                    placeholder="10"
                    value={value.affiliatePercent}
                    onChange={(e) => set("affiliatePercent", e.target.value)}
                  />
                </label>
              )}
              <label className="workspace-field">
                <span>Attribution window</span>
                <input
                  type="text"
                  placeholder="30"
                  value={value.affiliateAttributionDays}
                  onChange={(e) => set("affiliateAttributionDays", e.target.value)}
                />
              </label>
              <label className="workspace-field workspace-field--full">
                <span>Affiliate terms</span>
                <textarea
                  rows={2}
                  value={value.affiliateTerms}
                  onChange={(e) => set("affiliateTerms", e.target.value)}
                />
              </label>
            </div>
          )}
        </section>

        <section className="workspace-section" style={{ margin: 0 }}>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={value.creatorPoolEnabled}
              onChange={() =>
                onChange({
                  ...value,
                  creatorPoolEnabled: !value.creatorPoolEnabled,
                  creatorPoolMetrics:
                    value.creatorPoolMetrics.length > 0
                      ? value.creatorPoolMetrics
                      : defaultHybridPoolMetrics(),
                })
              }
            />
            <strong>Creator Pool</strong>
          </label>
          {value.creatorPoolEnabled && (
            <div className="workspace-grid" style={{ marginTop: 12 }}>
              <label className="workspace-field">
                <span>Pool amount</span>
                <input
                  type="text"
                  placeholder="$10,000"
                  value={value.creatorPoolAmount}
                  onChange={(e) => set("creatorPoolAmount", e.target.value)}
                />
              </label>
              <label className="workspace-field">
                <span>Distribution method</span>
                <select
                  value={value.creatorPoolDistribution}
                  onChange={(e) =>
                    set("creatorPoolDistribution", e.target.value as BrandCampaignHybridPoolDistribution)
                  }
                >
                  {POOL_DISTRIBUTION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {value.creatorPoolDistribution === "custom" && (
                <label className="workspace-field workspace-field--full">
                  <span>Custom distribution method</span>
                  <input
                    type="text"
                    value={value.creatorPoolCustomDistribution}
                    onChange={(e) => set("creatorPoolCustomDistribution", e.target.value)}
                  />
                </label>
              )}
              <label className="workspace-field workspace-field--full">
                <span>Campaign goal</span>
                <input
                  type="text"
                  value={value.creatorPoolGoal}
                  onChange={(e) => set("creatorPoolGoal", e.target.value)}
                />
              </label>
              <div className="workspace-field workspace-field--full">
                <span>Pool metrics</span>
                <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                  {value.creatorPoolMetrics.map((metric, index) => (
                    <div key={metric.id} style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 8 }}>
                      <input
                        aria-label={`Pool metric ${index + 1}`}
                        value={metric.name}
                        onChange={(e) =>
                          set(
                            "creatorPoolMetrics",
                            value.creatorPoolMetrics.map((row) =>
                              row.id === metric.id ? { ...row, name: e.target.value } : row,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label={`Pool metric ${index + 1} weight`}
                        value={metric.weightPercent}
                        onChange={(e) =>
                          set(
                            "creatorPoolMetrics",
                            value.creatorPoolMetrics.map((row) =>
                              row.id === metric.id ? { ...row, weightPercent: e.target.value } : row,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        className="crm-link-button"
                        onClick={() =>
                          set(
                            "creatorPoolMetrics",
                            value.creatorPoolMetrics.filter((row) => row.id !== metric.id),
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="crm-link-button"
                  style={{ marginTop: 8 }}
                  onClick={() =>
                    set("creatorPoolMetrics", [
                      ...value.creatorPoolMetrics,
                      { id: newMilestoneId(), name: "", weightPercent: "" },
                    ])
                  }
                >
                  + Add metric
                </button>
              </div>
              <label className="workspace-field">
                <span>Settlement timing</span>
                <select
                  value={value.creatorPoolSettlement}
                  onChange={(e) =>
                    set("creatorPoolSettlement", e.target.value as BrandCampaignHybridPoolSettlement)
                  }
                >
                  {POOL_SETTLEMENT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              {value.creatorPoolSettlement === "days_after_campaign_end" && (
                <label className="workspace-field">
                  <span>Days after campaign end</span>
                  <input
                    type="text"
                    value={value.creatorPoolSettlementDays}
                    onChange={(e) => set("creatorPoolSettlementDays", e.target.value)}
                  />
                </label>
              )}
              <label className="workspace-field workspace-field--full">
                <span>Pool rules</span>
                <textarea
                  rows={2}
                  value={value.creatorPoolRules}
                  onChange={(e) => set("creatorPoolRules", e.target.value)}
                />
              </label>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
