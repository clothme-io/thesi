import type { BrandCampaignHybridPayment } from "./types";

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );

export function commissionSummary(
  payment?: BrandCampaignHybridPayment,
): string {
  const basis =
    payment?.affiliate?.commissionType === "percentage_of_platform_commission"
      ? "platform commission from attributed sales"
      : "eligible sales attributed to the creator";
  return `${payment?.base?.enabled ? `${formatMoney(payment.base.amountCents ?? 0)} base per creator + ` : "Commission only: "}${payment?.affiliate?.commissionPercent ?? 0}% of ${basis}`;
}

export function commissionTerms(payment?: BrandCampaignHybridPayment): string {
  const base = payment?.base;
  const trigger =
    base?.trigger === "custom"
      ? base.customTrigger
      : base?.trigger.replaceAll("_", " ");
  return [
    base?.enabled
      ? `Base payment earned when: ${trigger || "not specified"}.`
      : "No fixed base payment is included.",
    `Attribution window: ${payment?.affiliate?.attributionWindowDays ?? "not specified"} days.`,
    payment?.affiliate?.terms,
    ...(payment?.affiliate?.fundingFlowVersion === 1 ? [
      'ClothME handles payouts. Qualifying sales fund creator commission.',
      ...(base?.enabled ? ['The brand prepays the base for each creator slot. ClothME releases your base after the brand accepts your work. Unused slot funds return to the brand at campaign closure.'] : ['No brand deposit is required.']),
    ] : [
    `Payout handler: ${payment?.affiliate?.payoutHandler === 'clothme' ? 'ClothME' : payment?.affiliate?.payoutHandler === 'brand' ? 'Brand' : 'not specified'}.`,
    `Proposed funding: ${payment?.affiliate?.fundingSource?.replaceAll('_',' ') ?? 'not agreed'}.`,
    payment?.affiliate?.fundingTerms,
    'Funding requires a separate agreement and approval.'
    ]),

  ]
    .filter(Boolean)
    .join("\n");
}
