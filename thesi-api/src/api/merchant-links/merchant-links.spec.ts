import type { ExecutionContext } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { MerchantServiceGuard } from './merchant-links.controller';
import { MerchantLinksService } from './merchant-links.service';
import { validateEnv } from 'src/platform/config/env.validation';

const key = 'test-only-dedicated-service-key-32-characters';
const request = (value?: unknown) => ({ switchToHttp: () => ({ getRequest: () => ({ headers: { 'x-thesi-merchant-key': value } }) }) }) as unknown as ExecutionContext;

describe('Merchant linking boundary', () => {
  it('requires the feature and a dedicated server credential', () => {
    const guard = new MerchantServiceGuard({ get: name => name === 'MERCHANT_LINKING_ENABLED' ? true : key } as ConfigService);
    expect(guard.canActivate(request(key))).toBe(true);
    for (const invalid of [undefined, '', 'wrong', [key], key + 'x']) expect(() => guard.canActivate(request(invalid))).toThrow('credentials');
    const disabled = new MerchantServiceGuard({ get: () => false } as unknown as ConfigService);
    expect(() => disabled.canActivate(request(key))).toThrow('unavailable');
  });
  it('does not query the linking tables while disabled', async () => {
    const service = new MerchantLinksService({} as never, { get: () => false } as unknown as ConfigService);
    await service.onApplicationBootstrap();
    await expect(service.mine('owner')).rejects.toThrow('unavailable');
    await expect(service.describe('code')).rejects.toThrow('unavailable');
  });
  it('validates configuration before exposing linking', () => {
    const config = { DATABASE_URL: 'postgresql://localhost/test', JWT_SECRET: 'test', JWT_REFRESH_SECRET: 'test', ADMIN_API_KEY: 'test', THESI_WEB_URL: 'https://thesi.example.test', NODE_ENV: 'production' };
    expect(validateEnv(config).MERCHANT_LINKING_ENABLED).toBe(false);
    expect(() => validateEnv({ ...config, MERCHANT_LINKING_ENABLED: 'true' })).toThrow('workspace');
    const enabled = { ...config, MERCHANT_LINKING_ENABLED: 'true', BRAND_WORKSPACES_ENABLED: 'true', BRAND_WORKSPACE_ACCESS_ENABLED: 'true', MERCHANT_LINK_SERVICE_KEY: key, MERCHANT_HUB_URL: 'https://merchant.example.test' };
    expect(validateEnv(enabled).MERCHANT_LINKING_ENABLED).toBe(true);
    expect(() => validateEnv({ ...enabled, MERCHANT_LINK_SERVICE_KEY: 'short' })).toThrow('dedicated service key');
    for (const url of ['http://merchant.example.test', 'https://user:secret@merchant.example.test', 'https://merchant.example.test/redirect', 'https://merchant.example.test/?next=elsewhere']) {
      expect(() => validateEnv({ ...enabled, MERCHANT_HUB_URL: url })).toThrow();
    }
  });
});
