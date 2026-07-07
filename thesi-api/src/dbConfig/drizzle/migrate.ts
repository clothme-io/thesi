import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { createPoolConfigFromEnv, formatDbTargetFromEnv } from './db-connection';

async function runMigrations() {
  const pool = new Pool(createPoolConfigFromEnv());
  const target = formatDbTargetFromEnv();

  console.log(`[migrate] Connecting to ${target}`);

  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder: './src/dbConfig/drizzle/migrations' });
    console.log('Migrations completed');
  } catch (error) {
    const host = process.env.POSTGRES_HOST || process.env.DATABASE_URL;
    if (host?.includes('postgres') && !host.includes('localhost')) {
      console.error(
        '\n[migrate] Could not reach Postgres. If you are running migrations on your machine',
      );
      console.error(
        '[migrate] (not inside Docker), use localhost:5433 in .env:',
      );
      console.error(
        '[migrate]   DATABASE_URL=postgresql://postgres:postgres@localhost:5433/thesi',
      );
      console.error('[migrate]   POSTGRES_HOST=localhost');
      console.error('[migrate]   POSTGRES_PORT=5433\n');
      console.error(
        '[migrate] Start Postgres first: cd .. && docker compose up postgres -d\n',
      );
    }
    throw error;
  } finally {
    await pool.end();
  }
}

runMigrations().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
