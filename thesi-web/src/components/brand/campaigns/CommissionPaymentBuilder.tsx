"use client";

import { isInstallCommission } from "@/lib/brand-campaigns/commission";
import {
  eventsForInstallApp,
  INSTALL_EVENT_LABELS,
  type InstallApp,
  type InstallConversionEvent,
} from "@/lib/brand-campaigns/install-conversions";
import type { HybridPaymentFormState } from "@/lib/brand-campaigns/payment-form";
import type { BrandCampaignHybridAffiliateType } from "@/lib/brand-campaigns/types";

export function CommissionPaymentBuilder({
  value,
  onChange,
  creatorCapacity,
  variant,
}: {
  value: HybridPaymentFormState;
  creatorCapacity?: string;
  onChange: (next: HybridPaymentFormState) => void;
  variant?: "product" | "install";
}) {
  const install =
    variant === "install" || isInstallCommission(value.affiliateType);
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
        {install ? (
          <InstallConversionFields value={value} onChange={onChange} />
        ) : (
        <label className="workspace-field">
          <span>Creator earns when</span>
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
              Percentage of attributed product sale
            </option>
            <option value="percentage_of_platform_commission">
              Percentage of platform commission
            </option>
            <option value="fixed_amount_per_sale">
              Fixed amount per attributed product sale
            </option>
          </select>
        </label>
        )}
        {value.affiliateType === "fixed_amount_per_sale" && !install ? (
          <label className="workspace-field">
            <span>Payout per attributed sale (USD)</span>
            <input
              name="commissionFixedAmount"
              inputMode="decimal"
              placeholder="2.00"
              value={value.affiliateFixedAmount}
              onChange={(e) => set("affiliateFixedAmount", e.target.value)}
            />
          </label>
        ) : install ? null : (
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
        )}
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
            placeholder={
              install
                ? "Define attribution rules and when selected conversion rewards are payable."
                : "Define eligible sales, discounts, taxes, shipping, refunds, attribution rules, and when commission is payable."
            }
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
              <span>{install ? "Install review period (days)" : "Sale review period (days)"}</span>
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
          ? `Base deposit before launch: ${Number(creatorCapacity) > 0 ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((Math.round(Number(value.baseAmount || 0) * 100) * Number(creatorCapacity)) / 100) : "set creator slots"}. Base per creator × creator slots. ClothME holds the deposit, releases each creator’s base after your acceptance of their work, and returns unused slot funds when you close the campaign.`
          : install
            ? "No deposit is required. Selected conversions are recorded as estimates for review."
            : "No deposit is required. Qualifying sales fund creator commission."}{" "}
        ClothME handles payouts.
        {install
          ? " This campaign does not collect a prepaid install pool. Opening the link only attributes the new user; payouts are not auto-paid."
          : " Sale payouts are funded from sales."}
      </p>
      <p className="workspace-hint">
        The optional base is a fixed amount per creator.
        {install
          ? " Leave an earning blank to track that conversion without paying. Raw app installs do not earn."
          : " Commission varies with qualifying sales. Platform commission means revenue the platform earns from those sales, not Thesi’s campaign service fee."}
      </p>
      <p className="workspace-hint">
        These fields record the agreed terms. Commission estimates require
        review. Commission payouts are not automated.
      </p>
    </div>
  );
}

function InstallConversionFields({
  value,
  onChange,
}: {
  value: HybridPaymentFormState;
  onChange: (next: HybridPaymentFormState) => void;
}) {
  const events = eventsForInstallApp(value.installApp);
  const toggle = (event: InstallConversionEvent, selected: boolean) => {
    const next = { ...value.installEventAmounts };
    if (selected) next[event] = next[event] ?? "";
    else delete next[event];
    onChange({
      ...value,
      installEventAmounts: next,
      ...(event === "x_products_listed" && !selected
        ? { installListedProductCount: "" }
        : {}),
    });
  };
  return (
    <fieldset className="workspace-field workspace-field--full">
      <legend>Conversion events</legend>
      <p className="workspace-hint">
        Choose Customer or Vendor, then pick one or more events. Opening the
        creator link only attributes the new user. Earnings are optional per
        event.
      </p>
      <label className="workspace-field">
        <span>App</span>
        <select
          name="installApp"
          value={value.installApp}
          onChange={(e) =>
            onChange({
              ...value,
              installApp: e.target.value as InstallApp,
              installEventAmounts: {},
              installListedProductCount: "",
            })
          }
        >
          <option value="customer">Customer app</option>
          <option value="vendor">Vendor app</option>
        </select>
      </label>
      {events.map((event) => {
        const selected = event in value.installEventAmounts;
        return (
          <div key={event} className="workspace-grid">
            <label className="workspace-field">
              <span>
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(e) => toggle(event, e.target.checked)}
                />{" "}
                {INSTALL_EVENT_LABELS[event]}
              </span>
            </label>
            {selected && (
              <label className="workspace-field">
                <span>Earning (USD, optional)</span>
                <input
                  name={`installEarning-${event}`}
                  inputMode="decimal"
                  placeholder="Leave blank for no payout"
                  value={value.installEventAmounts[event] ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      installEventAmounts: {
                        ...value.installEventAmounts,
                        [event]: e.target.value,
                      },
                    })
                  }
                />
              </label>
            )}
            {event === "x_products_listed" && selected && (
              <label className="workspace-field">
                <span>Number of products listed</span>
                <input
                  name="installListedProductCount"
                  inputMode="numeric"
                  placeholder="3"
                  value={value.installListedProductCount}
                  onChange={(e) =>
                    onChange({
                      ...value,
                      installListedProductCount: e.target.value,
                    })
                  }
                />
              </label>
            )}
          </div>
        );
      })}
    </fieldset>
  );
}
