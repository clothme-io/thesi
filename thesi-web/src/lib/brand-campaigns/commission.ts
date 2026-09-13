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
  return `${formatMoney(payment?.base?.amountCents ?? 0)} base per creator + ${payment?.affiliate?.commissionPercent ?? 0}% of ${basis}`;
}

export function commissionTerms(payment?: BrandCampaignHybridPayment): string {
  const base = payment?.base;
  const trigger =
    base?.trigger === "custom"
      ? base.customTrigger
      : base?.trigger.replaceAll("_", " ");
  return [
    `Base payment earned when: ${trigger || "not specified"}.`,
    `Attribution window: ${payment?.affiliate?.attributionWindowDays ?? "not specified"} days.`,
    payment?.affiliate?.terms,
  ]
    .filter(Boolean)
    .join("\n");
}
