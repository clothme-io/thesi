export const BRAND_SETTINGS_ROUTES = {
  root: "/app/settings",
  general: "/app/settings/general",
  notifications: "/app/settings/notifications",
  billing: "/app/settings/billing",
  paymentMethods: "/app/settings/payment-methods",
  paymentHistory: "/app/settings/payment-history",
  security: "/app/settings/security",
  preferences: "/app/settings/preferences",
} as const;

export type BrandSettingsSection = keyof typeof BRAND_SETTINGS_ROUTES;
