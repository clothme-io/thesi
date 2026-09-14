import { validateEnv } from './env.validation';

const validConfig = {
  DATABASE_URL: 'postgresql://localhost/thesi',
  JWT_SECRET: 'access-secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
  ADMIN_API_KEY: 'admin-secret',
  THESI_WEB_URL: 'https://dv-app.get-thesi.com',
};

describe('validateEnv', () => {
  it('keeps workspace discovery disabled unless explicitly enabled', () => {
    expect(validateEnv(validConfig).BRAND_WORKSPACES_ENABLED).toBe(false);
    expect(validateEnv(validConfig).BRAND_WORKSPACE_ACCESS_ENABLED).toBe(false);
    expect(validateEnv({ ...validConfig, BRAND_WORKSPACE_ACCESS_ENABLED: 'true' }).BRAND_WORKSPACE_ACCESS_ENABLED).toBe(true);
    expect(validateEnv({ ...validConfig, BRAND_WORKSPACES_ENABLED: 'false' }).BRAND_WORKSPACES_ENABLED).toBe(false);
    expect(validateEnv({ ...validConfig, BRAND_WORKSPACES_ENABLED: 'true' }).BRAND_WORKSPACES_ENABLED).toBe(true);
  });
  it('requires discovery and access protection before enabling new brands', () => {
    expect(validateEnv(validConfig).MULTI_BRAND_ENABLED).toBe(false);
    expect(() => validateEnv({ ...validConfig, MULTI_BRAND_ENABLED: 'true' })).toThrow('requires');
    expect(validateEnv({ ...validConfig, MULTI_BRAND_ENABLED: 'true', BRAND_WORKSPACES_ENABLED: 'true', BRAND_WORKSPACE_ACCESS_ENABLED: 'true' }).MULTI_BRAND_ENABLED).toBe(true);
  });
  it('accepts complete auth configuration', () => {
    expect(validateEnv(validConfig)).toMatchObject(validConfig);
  });

  it.each(Object.keys(validConfig))('rejects a missing %s', (key) => {
    const config = { ...validConfig, [key]: '' };
    expect(() => validateEnv(config)).toThrow(
      `Missing required environment variable: ${key}`,
    );
  });
});

describe('campaign product activation', () => {
  const linked = { ...validConfig, BRAND_WORKSPACES_ENABLED: true, BRAND_WORKSPACE_ACCESS_ENABLED: true,
    MERCHANT_LINKING_ENABLED: true, MERCHANT_LINK_SERVICE_KEY: 'l'.repeat(32), MERCHANT_HUB_URL: 'https://merchant.test' };
  it('defaults off and requires Merchant linking', () => {
    expect(validateEnv(validConfig).CAMPAIGN_PRODUCTS_ENABLED).toBe(false);
    expect(() => validateEnv({ ...validConfig, CAMPAIGN_PRODUCTS_ENABLED: true })).toThrow('require Merchant linking');
  });
  it('requires a catalog credential and fixed HTTPS service origin', () => {
    expect(() => validateEnv({ ...linked, CAMPAIGN_PRODUCTS_ENABLED: true })).toThrow('catalog key');
    const products = { ...linked, CAMPAIGN_PRODUCTS_ENABLED: true, MERCHANT_CATALOG_SERVICE_KEY: 'c'.repeat(32), MERCHANT_API_URL: 'https://vendor.test' };
    expect(validateEnv(products).CAMPAIGN_PRODUCTS_ENABLED).toBe(true);
    expect(() => validateEnv({ ...products, MERCHANT_API_URL: 'https://vendor.test/v1' })).toThrow('origin');
    expect(() => validateEnv({ ...products, MERCHANT_API_URL: 'http://vendor.test' })).toThrow('origin');
  });
});

it('keeps creator tracking disabled until products and a dedicated attribution key are configured', () => {
  expect(validateEnv(validConfig).CREATOR_TRACKING_ENABLED).toBe(false);
  expect(() => validateEnv({...validConfig,CREATOR_TRACKING_ENABLED:true})).toThrow('requires campaign products');
});

describe('Merchant sign-in activation',()=>{
  const ready={...validConfig,BRAND_WORKSPACES_ENABLED:true,BRAND_WORKSPACE_ACCESS_ENABLED:true,MULTI_BRAND_ENABLED:true,MERCHANT_LINKING_ENABLED:true,MERCHANT_LINK_SERVICE_KEY:'l'.repeat(32),MERCHANT_HUB_URL:'https://merchant.test',MERCHANT_API_URL:'https://vendor.test',MERCHANT_IDENTITY_SERVICE_KEY:'i'.repeat(32),MERCHANT_SSO_ENABLED:true};
  it('defaults off and requires the workspace and linking foundations',()=>{
    expect(validateEnv(validConfig).MERCHANT_SSO_ENABLED).toBe(false);
    expect(()=>validateEnv({...validConfig,MERCHANT_SSO_ENABLED:true})).toThrow('requires');
    expect(validateEnv(ready).MERCHANT_SSO_ENABLED).toBe(true);
  });
  it('rejects reused service credentials and unsafe identity origins',()=>{
    expect(()=>validateEnv({...ready,MERCHANT_IDENTITY_SERVICE_KEY:ready.MERCHANT_LINK_SERVICE_KEY})).toThrow('separate');
    for(const origin of ['http://vendor.test','https://vendor.test/path','https://user:pass@vendor.test'])expect(()=>validateEnv({...ready,MERCHANT_API_URL:origin})).toThrow('origin');
  });
});

describe('automatic commission settlement activation', () => {
  const settlementReady = {
    ...validConfig,
    BRAND_WORKSPACE_ACCESS_ENABLED: true,
    COMMISSION_EARNINGS_ENABLED: true,
    EARNINGS_SERVICE_KEY: 'e'.repeat(32),
    EARNINGS_REPORT_SERVICE_KEY: 'r'.repeat(32),
    COMMISSION_SETTLEMENT_ENABLED: true,
    STRIPE_SECRET_KEY: 'sk_test_local',
    SETTLEMENT_PLATFORM_ACCOUNT_ID: 'acct_local123',
    COMMERCE_SETTLEMENT_SERVICE_KEY: 's'.repeat(32),
    COMMERCE_SETTLEMENT_API_URL: 'https://commerce.test',
  };
  it('keeps automatic settlement and combined balance disabled unless explicitly enabled', () => {
    const env = validateEnv(validConfig);
    expect(env.COMMISSION_SETTLEMENT_AUTO_ENABLED).toBe(false);
    expect(env.COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED).toBe(false);
  });
  it('requires settlement before enabling the automatic runner', () => {
    expect(() =>
      validateEnv({ ...validConfig, COMMISSION_SETTLEMENT_AUTO_ENABLED: true }),
    ).toThrow('Automatic commission settlement requires settlement');
  });
  it('accepts bounded automatic settlement controls with settlement enabled', () => {
    expect(
      validateEnv({
        ...settlementReady,
        COMMISSION_SETTLEMENT_AUTO_ENABLED: true,
        COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED: true,
        COMMISSION_SETTLEMENT_AUTO_INTERVAL_MS: '60000',
        COMMISSION_SETTLEMENT_AUTO_WORKSPACE_LIMIT: '10',
      }),
    ).toMatchObject({
      COMMISSION_SETTLEMENT_AUTO_ENABLED: true,
      COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED: true,
      COMMISSION_SETTLEMENT_AUTO_INTERVAL_MS: 60000,
      COMMISSION_SETTLEMENT_AUTO_WORKSPACE_LIMIT: 10,
    });
  });
  it('rejects unsafe automatic settlement bounds', () => {
    expect(() =>
      validateEnv({ ...settlementReady, COMMISSION_SETTLEMENT_AUTO_INTERVAL_MS: '1000' }),
    ).toThrow('AUTO_INTERVAL');
    expect(() =>
      validateEnv({ ...settlementReady, COMMISSION_SETTLEMENT_AUTO_WORKSPACE_LIMIT: '101' }),
    ).toThrow('AUTO_WORKSPACE_LIMIT');
  });
});
