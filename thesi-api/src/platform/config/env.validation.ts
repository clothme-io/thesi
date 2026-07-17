export type AppEnv = Record<string, unknown> & {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ADMIN_API_KEY: string;
  THESI_WEB_URL: string;
};

const REQUIRED_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ADMIN_API_KEY',
  'THESI_WEB_URL',
] as const;

export function validateEnv(config: Record<string, unknown>): AppEnv {
  const validated = { ...config } as AppEnv;

  for (const key of REQUIRED_KEYS) {
    const value = config[key];
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Missing required environment variable: ${key}`);
    }
    validated[key] = value.trim();
  }

  return validated;
}
