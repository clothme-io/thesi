// Aggregate-only inventory. Does not load .env files or execute a migration.
// DATABASE_URL must be supplied by the approved execution environment.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

export const ownership = {
  brand_profile: 'user_id', campaign: 'owner_user_id', campaign_file: 'owner_user_id',
  marketplace_listing: 'owner_user_id', campaign_invite: 'brand_user_id',
  campaign_acceptance_snapshot: 'brand_user_id', inbox_thread: 'brand_user_id',
  brand_creator_favorite: 'brand_user_id', campaign_platform_fee: 'brand_user_id',
  creator_payout: 'brand_user_id',
};

export async function audit(client) {
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  try {
    await client.query("SET LOCAL statement_timeout = '30s'");
    const report = { capturedAt: new Date().toISOString() };
    report.accounts = (await client.query('SELECT role, count(*)::int AS count FROM public.thesi_users GROUP BY role ORDER BY role')).rows;
    const ready = (await client.query("SELECT to_regclass('thesi.brand_workspace') IS NOT NULL AS ready")).rows[0].ready;
    report.foundationInstalled = ready;
    const multi = (await client.query(`SELECT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_schema='thesi' AND table_name='brand_workspace' AND column_name='owner_user_id') AS ready`)).rows[0].ready;
    report.multiBrandInstalled = multi;
    const workspaceOwner = multi ? 'owner_user_id' : 'legacy_owner_user_id';
    const historySchemas = (await client.query(`SELECT n.nspname AS schema FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relname='flyway_schema_history'
      AND c.relkind='r' AND n.nspname IN ('public','applications','thesi') ORDER BY n.nspname`)).rows;
    report.migrations = [];
    for (const { schema } of historySchemas) {
      report.migrations.push({ schema, history: (await client.query(`SELECT version, description, success FROM "${schema}".flyway_schema_history ORDER BY installed_rank`)).rows });
    }
    report.migrationHistoryFound = historySchemas.length > 0;
    report.ownership = [];
    for (const [table, owner] of Object.entries(ownership)) {
      const count = (await client.query(`SELECT count(*)::int AS total,
        count(*) FILTER (WHERE u.id IS NULL OR u.role <> 'brand')::int AS invalid_owner
        FROM thesi.${table} t LEFT JOIN public.thesi_users u ON u.id=${multi && table === 'brand_profile' ? '(SELECT owner_user_id FROM thesi.brand_workspace WHERE id=t.workspace_id)' : `t.${owner}`}`)).rows[0];
      const association = ready ? (await client.query(`SELECT
        count(*) FILTER (WHERE t.workspace_id IS NULL)::int AS missing_workspace,
        count(*) FILTER (WHERE t.workspace_id IS NOT NULL AND (w.id IS NULL OR w.${table === 'brand_profile' ? 'legacy_owner_user_id' : workspaceOwner} IS DISTINCT FROM t.${owner}))::int AS conflicting_workspace
        FROM thesi.${table} t LEFT JOIN thesi.brand_workspace w ON w.id=t.workspace_id`)).rows[0] : {};
      report.ownership.push({ table, ...count, ...association });
    }
    report.campaignOwnerConflicts = [];
    for (const [table, owner] of Object.entries(ownership).filter(([t]) => ['campaign_file','marketplace_listing','campaign_invite','campaign_acceptance_snapshot','campaign_platform_fee','creator_payout'].includes(t))) {
      const result = (await client.query(`SELECT count(*)::int AS count FROM thesi.${table} t
        LEFT JOIN thesi.campaign c ON c.id::text=t.campaign_id::text
        WHERE c.id IS NULL OR c.owner_user_id IS DISTINCT FROM t.${owner}${ready ? ' OR c.workspace_id IS DISTINCT FROM t.workspace_id' : ''}`)).rows[0];
      report.campaignOwnerConflicts.push({ table, ...result });
    }
    report.payoutTotals = (await client.query('SELECT currency,status,count(*)::int AS count,sum(amount_cents)::text AS amount_cents FROM thesi.creator_payout GROUP BY currency,status ORDER BY currency,status')).rows;
    if (ready) {
      report.missingDefaultWorkspaces = (await client.query(`SELECT count(*)::int AS count FROM public.thesi_users u WHERE u.role='brand' AND NOT EXISTS (SELECT 1 FROM thesi.brand_workspace w WHERE w.legacy_owner_user_id=u.id)`)).rows[0].count;
      report.missingOwnerMemberships = (await client.query(`SELECT count(*)::int AS count FROM thesi.brand_workspace w WHERE w.${workspaceOwner} IS NOT NULL AND NOT EXISTS (SELECT 1 FROM thesi.brand_workspace_member m WHERE m.workspace_id=w.id AND m.user_id=w.${workspaceOwner} AND m.role='owner' AND m.status='active')`)).rows[0].count;
    }
    await client.query('COMMIT');
    return report;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (!process.env.DATABASE_URL) throw new Error('Supply DATABASE_URL through the approved read-only environment');
  const require = createRequire(new URL('../thesi-api/package.json', import.meta.url));
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000 });
  try { await client.connect(); console.log(JSON.stringify(await audit(client), null, 2)); }
  catch { console.error('Workspace audit failed. Check database access and migration compatibility; no migration was attempted.'); process.exitCode = 1; }
  finally { await client.end(); }
}
