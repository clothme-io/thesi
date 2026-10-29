// Disposable PostgreSQL funding integration check; provider operations are simulated.
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { readFile, readdir } from 'node:fs/promises';
import { verifyFunding } from '../verify-campaign-funding.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(path.join(root, 'thesi-api/package.json'));
require('reflect-metadata');
const Module = require('node:module');
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  return originalResolve.call(
    this,
    request.startsWith('src/')
      ? path.join(root, 'thesi-api/dist', request.slice(4))
      : request,
    ...rest,
  );
};
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const pool = new Pool({
  connectionString: 'postgresql://demo:demo-local-only@127.0.0.1:5844/thesi_demo',
});
const query = async (text, params = []) => (await pool.query(text, params)).rows;
try {
  const migrations = path.resolve(root, '../clothme-db/databases/thesi/sql');
  for (const file of (await readdir(migrations))
    .filter((name) => /^V\d+__.*\.sql$/.test(name))
    .sort((a, b) => Number(a.match(/^V(\d+)/)[1]) - Number(b.match(/^V(\d+)/)[1]))) {
    await query('BEGIN');
    try {
      await query(await readFile(path.join(migrations, file), 'utf8'));
      await query('COMMIT');
    } catch (error) {
      await query('ROLLBACK');
      throw new Error(`${file}: ${error.message}`);
    }
  }
  for (const [id, role] of [['owner', 'brand'], ['other', 'brand']]) {
    await query(
      `INSERT INTO public.thesi_users(id,email,password_hash,full_name,role)
       VALUES ($1,$2,'fixture',$1,$3) ON CONFLICT DO NOTHING`,
      [id, `${id}@example.test`, role],
    );
  }
  await query('SELECT * FROM thesi.backfill_brand_workspaces(100)');
  const workspace = (await query("SELECT id FROM thesi.brand_workspace WHERE owner_user_id='owner'"))[0].id;
  const id = (n) => `${String(n).padStart(8, '0')}-1111-4111-8111-111111111111`;
  const [merchantLink] = await query(
    `INSERT INTO thesi.merchant_brand_link(vendor_id,merchant_brand_id,vendor_name,merchant_brand_name,workspace_id,linked_by_user_id)
     VALUES ($1,$2,'Vendor','Brand',$3,'owner') RETURNING id`,
    [id(1), id(2), workspace],
  );
  const payment = {
    model: 'commission',
    hybrid: {
      base: { enabled: true, amountCents: 10000, currency: 'USD', trigger: 'content_accepted' },
      affiliate: {
        enabled: true,
        commissionType: 'percentage_of_sale',
        commissionPercent: 10,
        currency: 'USD',
        attributionWindowDays: 30,
        terms: 'Eligible sales after returns.',
      },
    },
    promotedProduct: {
      productId: id(3),
      brandId: id(2),
      vendorId: id(1),
      workspaceId: workspace,
      linkId: merchantLink.id,
      title: 'Shirt',
      description: 'Linen',
      brandName: 'Brand',
      imageUrl: null,
      previewUrl: 'https://thesi.test/preview',
      verifiedAt: new Date().toISOString(),
    },
  };
  await verifyFunding({ root, require, database: drizzle(pool), query, workspace, payment, id });
} finally {
  await pool.end();
}
