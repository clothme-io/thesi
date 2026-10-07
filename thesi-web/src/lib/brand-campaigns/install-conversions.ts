export const INSTALL_APPS = ["customer", "vendor"] as const;
export const CUSTOMER_INSTALL_EVENTS = [
  "verified_account",
  "fit_profile_completed",
  "first_purchase",
] as const;
export const VENDOR_INSTALL_EVENTS = [
  "vendor_registered",
  "vendor_approved",
  "store_completed",
  "product_listed",
  "x_products_listed",
  "first_sale",
] as const;
export const INSTALL_CONVERSION_EVENTS = [
  ...CUSTOMER_INSTALL_EVENTS,
  ...VENDOR_INSTALL_EVENTS,
] as const;

export type InstallApp = (typeof INSTALL_APPS)[number];
export type InstallConversionEvent = (typeof INSTALL_CONVERSION_EVENTS)[number];

export type InstallConversion = {
  event: InstallConversionEvent;
  amountCents?: number;
  listedProductCount?: number;
};

export const INSTALL_EVENT_LABELS: Record<InstallConversionEvent, string> = {
  verified_account: "Verified account",
  fit_profile_completed: "Fit profile completed",
  first_purchase: "First purchase",
  vendor_registered: "Vendor registered",
  vendor_approved: "Vendor approved",
  store_completed: "Store completed",
  product_listed: "Product listed",
  x_products_listed: "X products listed",
  first_sale: "First sale",
};

export function isInstallApp(value: unknown): value is InstallApp {
  return INSTALL_APPS.includes(value as InstallApp);
}

export function isInstallConversionEvent(
  value: unknown,
): value is InstallConversionEvent {
  return INSTALL_CONVERSION_EVENTS.includes(value as InstallConversionEvent);
}

export function eventsForInstallApp(
  app: InstallApp,
): readonly InstallConversionEvent[] {
  return app === "vendor" ? VENDOR_INSTALL_EVENTS : CUSTOMER_INSTALL_EVENTS;
}

const money = (cents: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);

export function installConversionLabel(conversion: InstallConversion): string {
  const name =
    conversion.event === "x_products_listed" && conversion.listedProductCount
      ? `${conversion.listedProductCount} products listed`
      : INSTALL_EVENT_LABELS[conversion.event];
  return conversion.amountCents
    ? `${money(conversion.amountCents)} for ${name}`
    : `${name} (tracked, no payout)`;
}

export function installConversionsSummary(conversions?: InstallConversion[]) {
  if (!conversions?.length) return "qualified app install";
  return conversions.map(installConversionLabel).join("; ");
}
