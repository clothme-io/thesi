#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(new URL('..', import.meta.url).pathname);
const sibling = (name) => path.resolve(root, '..', name);
const checks = [];
function exists(label, file) {
  const ok = fs.existsSync(file);
  checks.push({ label, ok, detail: path.relative(root, file) || file });
  return ok;
}
function contains(label, file, pattern) {
  const ok = fs.existsSync(file) && pattern.test(fs.readFileSync(file, 'utf8'));
  checks.push({ label, ok, detail: path.relative(root, file) });
  return ok;
}
function migration(db, version, name) {
  exists(`${db} migration ${version}`, path.join(sibling('clothme-db'), 'databases', db, 'sql', `${version}__${name}.sql`));
}

exists('clothme-db sibling repo', sibling('clothme-db'));
exists('customer-api sibling repo', sibling('customer-api'));
exists('vendor-api sibling repo', sibling('vendor-api'));

for (const [db, version, name] of [
  ['thesi', 'V33', 'brand_workspace_foundation'],
  ['thesi', 'V34', 'owner_managed_brand_workspaces'],
  ['thesi', 'V35', 'merchant_brand_links'],
  ['thesi', 'V36', 'creator_tracking_links'],
  ['thesi', 'V37', 'commission_earnings'],
  ['thesi', 'V38', 'campaign_base_funding'],
  ['thesi', 'V39', 'settlement_requests'],
  ['thesi', 'V40', 'merchant_login'],
  ['thesi', 'V41', 'multi_product_links'],
  ['thesi', 'V42', 'commission_settlement_batches'],
  ['commerce', 'V18', 'creator_attribution'],
  ['commerce', 'V19', 'commission_event_delivery'],
  ['commerce', 'V20', 'verified_refund_allocations'],
  ['commerce', 'V21', 'creator_sales_reserve'],
  ['commerce', 'V22', 'creator_settlement'],
  ['commerce', 'V23', 'creator_risk_review'],
  ['commerce', 'V24', 'creator_attribution_quantity'],
]) migration(db, version, name);

contains('Thesi combined-balance flag documented', path.join(root, 'thesi-api/.env.example'), /COMMISSION_SETTLEMENT_COMBINED_BALANCE_ENABLED=false/);
contains('Thesi automatic settlement flag documented', path.join(root, 'thesi-api/.env.example'), /COMMISSION_SETTLEMENT_AUTO_ENABLED=false/);
contains('Thesi scheduler implemented', path.join(root, 'thesi-api/src/api/commission-earnings/commission-settlement.service.ts'), /runScheduledSettlements/);
contains('Commerce combined proof validation implemented', path.join(sibling('customer-api'), 'src/modules/commerce/application/creator-settlement.service.ts'), /combinedPayoutCoversMinimum/);
contains('Thesi API dev deploy health check exists', path.join(root, '.github/workflows/release.yml'), /DEV_HEALTH_URL: https:\/\/dv\.get-thesi\.com\/v1\/ready/);
contains('Thesi Web dev deploy health check exists', path.join(root, '.github/workflows/release-web.yml'), /DEV_HEALTH_URL: https:\/\/dv-app\.get-thesi\.com\//);
contains('clothme-db dev Flyway job wait exists', path.join(sibling('clothme-db'), '.github/workflows/release.yml'), /Wait for Flyway Job Completed on clothme-dev/);
contains('Cluster Flyway laptop ban documented', path.join(sibling('clothme-db'), 'docs/MUST-DOS-AND-DONTS.md'), /Do not.*Flyway against the cluster/s);
contains('Phase 11 runbook exists', path.join(root, 'docs/PHASE-11-DEV-ROLLOUT.md'), /Dev deployment order/);
contains('Prod app rollout still requires completion', path.join(root, '.github/workflows/release.yml'), /Configure prod kubeconfig[\s\S]*exit 1/);
contains('Prod web rollout still requires completion', path.join(root, '.github/workflows/release-web.yml'), /Configure prod kubeconfig[\s\S]*exit 1/);

const failed = checks.filter((check) => !check.ok);
for (const check of checks) {
  console.log(`${check.ok ? 'PASS' : 'FAIL'} ${check.label} — ${check.detail}`);
}
if (failed.length) {
  console.error(`\n${failed.length} readiness check(s) failed.`);
  process.exit(1);
}
console.log(`\nPASS Phase 11 local readiness audit: ${checks.length} checks.`);
