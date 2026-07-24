export type AppEnv = Record<string, unknown> & {
  DATABASE_URL: string;
  JWT_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ADMIN_API_KEY: string;
  THESI_WEB_URL: string;
  AUTH_FORCE_PASSWORD_CHANGE: boolean;
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

  return validated;
}
