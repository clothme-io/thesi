import type {
  BrandCampaignHybridAffiliateType,
  BrandCampaignHybridPayment,
  BrandCampaignPaymentModel,
} from "./types";
import { installConversionsSummary } from "./install-conversions";

type PaymentKind = {
  model?: string;
  hybrid?: { affiliate?: { commissionType?: string } };
};

export function isInstallCommission(
  type?: BrandCampaignHybridAffiliateType | string | null,
) {
  return type === "fixed_amount_per_install";
}

export function isAttributedCommissionPayment(payment?: PaymentKind | null) {
  return (
    payment?.model === "commission" ||
    payment?.model === "product_commission" ||
    payment?.model === "app_install"
  );
}

export function isAppInstallPayment(payment?: PaymentKind | null) {
  if (payment?.model === "app_install") return true;
  return (
    payment?.model === "commission" &&
    isInstallCommission(payment.hybrid?.affiliate?.commissionType)
  );
}

export function isProductCommissionPayment(payment?: PaymentKind | null) {
  if (payment?.model === "product_commission") return true;
  return (
    payment?.model === "commission" &&
    !isInstallCommission(payment.hybrid?.affiliate?.commissionType)
  );
}

export function formPaymentModel(
  payment?: PaymentKind | null,
): BrandCampaignPaymentModel {
  if (isAppInstallPayment(payment)) return "app_install";
  if (isProductCommissionPayment(payment)) return "product_commission";
  return (payment?.model as BrandCampaignPaymentModel) ?? "flat_rate";
}

const formatMoney = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );

export function commissionSummary(
  payment?: BrandCampaignHybridPayment,
): string {
  if (payment?.affiliate?.commissionType === "fixed_amount_per_install") {
    const conversions = installConversionsSummary(payment.affiliate.conversions);
    const installPay = payment.affiliate.conversions?.length
      ? conversions
      : `${formatMoney(payment.affiliate.fixedAmountCents ?? 0)} per qualified app install`;
    return `${payment?.base?.enabled ? `${formatMoney(payment.base.amountCents ?? 0)} base per creator + ` : ""}${installPay}`;
  }
  if (payment?.affiliate?.commissionType === "fixed_amount_per_sale") {
    return `${payment?.base?.enabled ? `${formatMoney(payment.base.amountCents ?? 0)} base per creator + ` : ""}${formatMoney(payment.affiliate.fixedAmountCents ?? 0)} per attributed product sale`;
  }
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
    payment?.affiliate?.commissionType === "fixed_amount_per_install"
      ? payment.affiliate.conversions?.length
        ? `Selected conversions: ${installConversionsSummary(payment.affiliate.conversions)}. Opening the install link only attributes the new user.`
        : "Install payout applies once per qualified new ClothME install/account according to the attribution rules."
      : undefined,
    `Attribution window: ${payment?.affiliate?.attributionWindowDays ?? "not specified"} days.`,
    payment?.affiliate?.terms,
    ...(payment?.affiliate?.fundingFlowVersion === 1 ? [
      isInstallCommission(payment?.affiliate?.commissionType)
        ? "ClothME handles payouts. Opening the install link only attributes the new user. Earnings are estimates until a selected conversion is reviewed. This campaign does not collect a prepaid install pool."
        : "ClothME handles payouts. Qualifying sales fund creator commission.",
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
