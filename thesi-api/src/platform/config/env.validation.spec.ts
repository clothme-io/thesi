import { validateEnv } from './env.validation';

const validConfig = {
  DATABASE_URL: 'postgresql://localhost/thesi',
  JWT_SECRET: 'access-secret',
  JWT_REFRESH_SECRET: 'refresh-secret',
  ADMIN_API_KEY: 'admin-secret',
  THESI_WEB_URL: 'https://dv-app.get-thesi.com',
};

describe('validateEnv', () => {
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
