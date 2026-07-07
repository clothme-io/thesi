import { ConfigService } from '@nestjs/config';
import { PoolConfig } from 'pg';

function readFromProcessEnv(key: string): string | undefined {
  const value = process.env[key];
  return value === undefined || value === '' ? undefined : value;
}

function readFromConfigService(configService: ConfigService, key: string): string | undefined {
  const value = configService.get<string>(key);
  return value === undefined || value === '' ? undefined : value;
}

/**
 * Build a pg Pool config for host or Docker runs.
 *
 * Host dev (API/migrations run on your machine):
 *   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/thesi
 *
 * Docker Compose (API runs inside the thesi-api container):
 *   DATABASE_URL=postgresql://postgres:postgres@postgres:5432/thesi
 */
export function createPoolConfigFromEnv(): PoolConfig {
  return buildPoolConfig(readFromProcessEnv);
}

export function createPoolConfig(configService: ConfigService): PoolConfig {
  return buildPoolConfig((key) => readFromConfigService(configService, key));
}

function buildPoolConfig(read: (key: string) => string | undefined): PoolConfig {
  const host = read('POSTGRES_HOST');
  const port = Number(read('POSTGRES_PORT') || 5432);
  const databaseUrl = read('DATABASE_URL');
  const ssl = read('POSTGRES_SSL_ENABLED') === 'true';
  const poolMax = Number(read('DB_POOL_MAX') || 10);

  if (host === 'postgres' || host === 'postgres-local') {
    return {
      host,
      port,
      user: read('POSTGRES_USER'),
      password: read('POSTGRES_PASSWORD'),
      database: read('POSTGRES_DB'),
      ssl: false,
      max: poolMax,
    };
  }

  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      ssl: ssl ? { rejectUnauthorized: false } : false,
      max: poolMax,
    };
  }

  return {
    host,
    port,
    user: read('POSTGRES_USER'),
    password: read('POSTGRES_PASSWORD'),
    database: read('POSTGRES_DB'),
    ssl: ssl ? { rejectUnauthorized: false } : false,
    max: poolMax,
  };
}

export function formatDbTargetFromEnv(): string {
  return formatDbTarget(createPoolConfigFromEnv());
}

function formatDbTarget(config: PoolConfig): string {
  if ('connectionString' in config && config.connectionString) {
    return config.connectionString.replace(/:[^:@/]+@/, ':***@');
  }
  return `${config.host ?? 'unknown'}:${config.port ?? 5432}/${config.database ?? 'unknown'}`;
}
