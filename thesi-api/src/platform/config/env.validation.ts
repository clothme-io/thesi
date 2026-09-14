export type AppEnv = Record<string, unknown> & {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ADMIN_API_KEY: string;
  THESI_WEB_URL: string;
  AUTH_FORCE_PASSWORD_CHANGE: boolean;
  BRAND_WORKSPACES_ENABLED: boolean;
  BRAND_WORKSPACE_ACCESS_ENABLED: boolean;
  MULTI_BRAND_ENABLED: boolean;
  MERCHANT_LINKING_ENABLED: boolean;
  MERCHANT_SSO_ENABLED: boolean;
  COMMISSION_SETTLEMENT_AUTO_ENABLED: boolean;
  COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED: boolean;
};

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ADMIN_API_KEY',
  'THESI_WEB_URL',
] as const;

function parseBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return fallback;
}
function parseIntBounded(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  name: string,
): number {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
}

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const validated = { ...config } as AppEnv;

  for (const key of REQUIRED_KEYS) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    validated[key] = value.trim();
  }

  validated.AUTH_FORCE_PASSWORD_CHANGE = parseBool(
    config.AUTH_FORCE_PASSWORD_CHANGE,
    true,
  );
  validated.BRAND_WORKSPACES_ENABLED = parseBool(config.BRAND_WORKSPACES_ENABLED, false);
  validated.BRAND_WORKSPACE_ACCESS_ENABLED = parseBool(config.BRAND_WORKSPACE_ACCESS_ENABLED, false);
  validated.MULTI_BRAND_ENABLED = parseBool(config.MULTI_BRAND_ENABLED, false);
  if (validated.MULTI_BRAND_ENABLED && (!validated.BRAND_WORKSPACE_ACCESS_ENABLED || !validated.BRAND_WORKSPACES_ENABLED)) {
    throw new Error('MULTI_BRAND_ENABLED requires workspace discovery and access enforcement');
  }

  validated.MERCHANT_LINKING_ENABLED = parseBool(config.MERCHANT_LINKING_ENABLED, false);
  if (validated.MERCHANT_LINKING_ENABLED) {
    if (!validated.BRAND_WORKSPACES_ENABLED || !validated.BRAND_WORKSPACE_ACCESS_ENABLED) throw new Error('Merchant linking requires workspace discovery and access enforcement');
    if (typeof config.MERCHANT_LINK_SERVICE_KEY !== 'string' || config.MERCHANT_LINK_SERVICE_KEY.length < 32) throw new Error('Merchant linking requires a dedicated service key of at least 32 characters');
    for (const key of ['MERCHANT_HUB_URL', 'THESI_WEB_URL']) {
      const url = new URL(String(config[key] ?? ''));
      const local = config.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
      if ((!local && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error(`${key} must be an HTTPS origin (localhost HTTP is allowed in development)`);
    }
  }
  validated.CAMPAIGN_PRODUCTS_ENABLED = parseBool(config.CAMPAIGN_PRODUCTS_ENABLED, false);
  if (validated.CAMPAIGN_PRODUCTS_ENABLED) {
    if (!validated.MERCHANT_LINKING_ENABLED) throw new Error('Campaign products require Merchant linking');
    if (typeof config.MERCHANT_CATALOG_SERVICE_KEY !== 'string' || config.MERCHANT_CATALOG_SERVICE_KEY.length < 32) throw new Error('Campaign products require a dedicated catalog key of at least 32 characters');
    const url = new URL(String(config.MERCHANT_API_URL ?? ''));
    const local = config.NODE_ENV !== 'production' && ['localhost', '127.0.0.1'].includes(url.hostname);
    if ((!local && url.protocol !== 'https:') || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || url.pathname !== '/') throw new Error('MERCHANT_API_URL must be an HTTPS origin');
  }
  validated.CREATOR_TRACKING_ENABLED = parseBool(config.CREATOR_TRACKING_ENABLED, false);
  if (validated.CREATOR_TRACKING_ENABLED) {
    if (!validated.CAMPAIGN_PRODUCTS_ENABLED) throw new Error('Creator tracking requires campaign products');
    if (typeof config.ATTRIBUTION_SERVICE_KEY !== 'string' || config.ATTRIBUTION_SERVICE_KEY.length < 32) throw new Error('Creator tracking requires a dedicated attribution service key of at least 32 characters');
  }
  validated.CREATOR_LINKS_ENABLED = parseBool(config.CREATOR_LINKS_ENABLED, false);
  if (validated.CREATOR_LINKS_ENABLED && !validated.CREATOR_TRACKING_ENABLED) throw new Error('New creator links require creator tracking');
  validated.COMMISSION_EARNINGS_ENABLED = parseBool(config.COMMISSION_EARNINGS_ENABLED, false);
  if (validated.COMMISSION_EARNINGS_ENABLED) {
    if (!validated.BRAND_WORKSPACE_ACCESS_ENABLED) throw new Error('Commission earnings require workspace access enforcement');
    for (const key of ['EARNINGS_SERVICE_KEY','EARNINGS_REPORT_SERVICE_KEY']) if (typeof config[key] !== 'string' || String(config[key]).length < 32) throw new Error(`${key} must contain at least 32 characters`);
    if (config.EARNINGS_SERVICE_KEY === config.EARNINGS_REPORT_SERVICE_KEY) throw new Error('Earnings delivery and operations reporting require separate keys');
  }
  validated.CAMPAIGN_FUNDING_ENABLED=parseBool(config.CAMPAIGN_FUNDING_ENABLED,false);
  if(validated.CAMPAIGN_FUNDING_ENABLED && (!validated.BRAND_WORKSPACE_ACCESS_ENABLED || !config.STRIPE_SECRET_KEY)) throw new Error('Campaign funding requires workspace enforcement and real Stripe configuration');
  validated.COMMISSION_SETTLEMENT_ENABLED=parseBool(config.COMMISSION_SETTLEMENT_ENABLED,false);
  validated.COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED=parseBool(config.COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED,false);
  validated.COMMISSION_SETTLEMENT_AUTO_ENABLED=parseBool(config.COMMISSION_SETTLEMENT_AUTO_ENABLED,false);
  validated.COMMISSION_SETTLEMENT_AUTO_INTERVAL_MS=parseIntBounded(config.COMMISSION_SETTLEMENT_AUTO_INTERVAL_MS,3600000,60000,86400000,'COMMISSION_SETTLEMENT_AUTO_INTERVAL_MS');
  validated.COMMISSION_SETTLEMENT_AUTO_WORKSPACE_LIMIT=parseIntBounded(config.COMMISSION_SETTLEMENT_AUTO_WORKSPACE_LIMIT,25,1,100,'COMMISSION_SETTLEMENT_AUTO_WORKSPACE_LIMIT');
  if(validated.COMMISSION_SETTLEMENT_ENABLED){
    if(!validated.COMMISSION_EARNINGS_ENABLED||!config.STRIPE_SECRET_KEY||!/^acct_[A-Za-z0-9]+$/.test(String(config.SETTLEMENT_PLATFORM_ACCOUNT_ID??'')))throw new Error('Commission settlement requires reporting and a verified Stripe platform account');
    if(String(config.COMMERCE_SETTLEMENT_SERVICE_KEY??'').length<32)throw new Error('Settlement requires a dedicated service key');
    const u=new URL(String(config.COMMERCE_SETTLEMENT_API_URL??''));
    if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||(config.NODE_ENV!=='production'&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))))throw new Error('Invalid Commerce settlement origin');
  }
  if(validated.COMMISSION_SETTLEMENT_AUTO_ENABLED && !validated.COMMISSION_SETTLEMENT_ENABLED)throw new Error('Automatic commission settlement requires settlement to be enabled');
  validated.MERCHANT_SSO_ENABLED=parseBool(config.MERCHANT_SSO_ENABLED,false);
  if(validated.MERCHANT_SSO_ENABLED){
    if(!validated.MERCHANT_LINKING_ENABLED||!validated.MULTI_BRAND_ENABLED)throw new Error('Merchant sign-in requires linking and multi-brand access');
    if(typeof config.MERCHANT_IDENTITY_SERVICE_KEY!=='string'||config.MERCHANT_IDENTITY_SERVICE_KEY.length<32||config.MERCHANT_IDENTITY_SERVICE_KEY===config.MERCHANT_LINK_SERVICE_KEY||config.MERCHANT_IDENTITY_SERVICE_KEY===config.MERCHANT_CATALOG_SERVICE_KEY)throw new Error('Merchant sign-in requires a separate identity service key');
    const u=new URL(String(config.MERCHANT_API_URL??''));
    if(u.username||u.password||u.search||u.hash||u.pathname!=='/'||!(u.protocol==='https:'||(config.NODE_ENV!=='production'&&u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname))))throw new Error('Invalid Merchant identity origin');
  }
  validated.COMMISSION_RULES_ENABLED=parseBool(config.COMMISSION_RULES_ENABLED,false);
  if(validated.COMMISSION_RULES_ENABLED && !parseBool(config.CAMPAIGN_MULTI_PRODUCTS_ENABLED,false))throw new Error('Commission rules require multi-product campaigns');
  validated.CAMPAIGN_MULTI_PRODUCTS_ENABLED=parseBool(config.CAMPAIGN_MULTI_PRODUCTS_ENABLED,false);
  if(validated.CAMPAIGN_MULTI_PRODUCTS_ENABLED&&!validated.CAMPAIGN_PRODUCTS_ENABLED)throw new Error('Multi-product campaigns require campaign products');
  return validated;
}
