// Local-only walkthrough adapter: real application services + Docker Postgres, simulated provider and login.
// This script is never imported by either production API. No live keys or network payment calls.
import http from "node:http";
import { readFile, readdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const require = createRequire(path.join(root, "thesi-api/package.json"));
require("reflect-metadata");
const Module = require("node:module"),
  resolve = Module._resolveFilename;
Module._resolveFilename = function (p, ...rest) {
  return resolve.call(
    this,
    p.startsWith("src/") ? path.join(root, "thesi-api/dist", p.slice(4)) : p,
    ...rest,
  );
};
const { Pool } = require("pg"),
  { drizzle } = require("drizzle-orm/node-postgres");
const pg = new Pool({
    connectionString:
      "postgresql://demo:demo-local-only@127.0.0.1:5844/thesi_demo",
  }),
  commerce = new Pool({
    connectionString:
      "postgresql://demo:demo-local-only@127.0.0.1:5844/commerce_demo",
  });
async function migrate(db, name, marker) {
  if ((await db.query("SELECT to_regclass($1) AS name", [marker])).rows[0].name)
    return;
  const dir = path.resolve(root, `../clothme-db/databases/${name}/sql`);
  for (const f of (await readdir(dir))
    .filter((f) => /^V\d+__.*\.sql$/.test(f))
    .sort(
      (a, b) => Number(a.match(/^V(\d+)/)[1]) - Number(b.match(/^V(\d+)/)[1]),
    )) {
    await db.query("BEGIN");
    try {
      await db.query(await readFile(path.join(dir, f), "utf8"));
      await db.query("COMMIT");
    } catch (e) {
      await db.query("ROLLBACK");
      throw new Error(`${f}: ${e.message}`);
    }
  }
}
await migrate(pg, "thesi", "thesi.commission_settlement_request");
await migrate(commerce, "commerce", "commerce.creator_settlement_entry");
const db = drizzle(pg);
const api = (p) => require(path.join(root, "thesi-api/dist/api", p));
const customerRequire = createRequire(
  path.resolve(root, "../customer-api/package.json"),
);
const customer = (p) =>
  customerRequire(
    path.resolve(root, "../customer-api/dist/modules/commerce", p),
  );
const { workspaceContext } = api("brand-workspaces/workspace-context.js");
const { CampaignFundingService } = api(
  "campaign-funding/campaign-funding.service.js",
);
const { CommissionSettlementService } = api(
  "commission-earnings/commission-settlement.service.js",
);
const { PostgresCampaignRepository } = api(
  "campaigns/postgres-campaign.repository.js",
);
const { PostgresInvitesRepository } = api(
  "invites/postgres-invites.repository.js",
);
const { CreatorSettlementService } = customer(
  "application/creator-settlement.service.js",
);
const { CommissionDeliveryService } = customer(
  "application/commission-delivery.service.js",
);
const { PostgresVendorSplitRepository } = customer(
  "infrastructure/postgres-vendor-split.repository.js",
);
const id = (n) => `${String(n).padStart(8, "0")}-2222-4222-8222-222222222222`;
const campaignId = id(1),
  saleCampaignId = id(2),
  lineId = id(3),
  orderId = id(4),
  receiptId = id(5),
  vendorId = id(6),
  brandId = id(7),
  productId = id(8),
  accountId = id(9),
  personId = id(10);
for (const [user, role, name] of [
  ["demo-brand", "brand", "Demo Brand"],
  ["demo-creator-a", "creator", "Ada — Demo Creator"],
  ["demo-creator-b", "creator", "Ben — Demo Creator"],
])
  await pg.query(
    "INSERT INTO public.thesi_users(id,email,password_hash,full_name,role) VALUES($1,$2,'demo-adapter-only',$3,$4) ON CONFLICT DO NOTHING",
    [user, `${user}@example.test`, name, role],
  );
await pg.query("SELECT * FROM thesi.backfill_brand_workspaces(100)");
const workspace = (
  await pg.query(
    "SELECT id FROM thesi.brand_workspace WHERE owner_user_id='demo-brand'",
  )
).rows[0].id;
await pg.query(
  "INSERT INTO thesi.merchant_brand_link(id,vendor_id,merchant_brand_id,vendor_name,merchant_brand_name,workspace_id,linked_by_user_id) VALUES($1,$2,$3,'Demo Merchant','Demo Brand',$4,'demo-brand') ON CONFLICT DO NOTHING",
  [id(11), vendorId, brandId, workspace],
);
const terms = {
  model: "commission",
  hybrid: {
    base: {
      enabled: true,
      amountCents: 10000,
      currency: "USD",
      trigger: "content_accepted",
    },
    affiliate: {
      enabled: true,
      commissionType: "percentage_of_sale",
      commissionPercent: 10,
      currency: "USD",
      attributionWindowDays: 30,
      terms: "Demo eligible merchandise sales; refunds reduce commission.",
      fundingFlowVersion: 1,
      payoutHandler: "clothme",
      fundingSource: "brand",
    },
  },
  promotedProduct: {
    productId,
    brandId,
    vendorId,
    workspaceId: workspace,
    linkId: id(11),
    title: "Linen everyday shirt",
    brandName: "Demo Brand",
    description: "Local product fixture",
    previewUrl: "http://127.0.0.1:3011/local-payments",
    verifiedAt: new Date().toISOString(),
  },
};
const saleTerms = structuredClone(terms);
delete saleTerms.hybrid.base;
for (const [cid, name, status, payment] of [
  [campaignId, "Linen launch — optional base", "draft", terms],
  [saleCampaignId, "Commission-only sales demo", "active", saleTerms],
])
  await pg.query(
    `INSERT INTO thesi.campaign(id,owner_user_id,workspace_id,name,campaign_type,status,start_date,end_date,payment,creator_capacity) SELECT $1,'demo-brand',$2,$3,'product',$4,CURRENT_DATE,CURRENT_DATE+30,$5,3 WHERE NOT EXISTS(SELECT 1 FROM thesi.campaign WHERE id=$1) ON CONFLICT DO NOTHING`,
    [cid, workspace, name, status, payment],
  );
const repository = new PostgresCampaignRepository(db),
  invites = new PostgresInvitesRepository(db);
await invites.createAcceptanceSnapshot({
  campaignId: saleCampaignId,
  brandUserId: "demo-brand",
  creatorUserId: "demo-creator-a",
  creatorEmail: "demo-creator-a@example.test",
  creatorName: "Ada — Demo Creator",
  source: "campaign_invite",
  sourceId: id(12),
});
const accepted = (
  await pg.query(
    "SELECT id FROM thesi.campaign_acceptance_snapshot WHERE campaign_id=$1 AND creator_user_id='demo-creator-a'",
    [saleCampaignId],
  )
).rows[0];
await pg.query(
  "INSERT INTO thesi.creator_tracking_link(id,acceptance_snapshot_id,public_code) VALUES($1,$2,$3) ON CONFLICT DO NOTHING",
  [id(23), accepted.id, "d".repeat(43)],
);
await pg.query(
  "INSERT INTO thesi.creator_click_grant(id,tracking_link_id,code_hash,clicked_at,redeem_until,expires_at,buyer_key,claimed_at) VALUES($1,$2,'demo-hash',now()-interval '32 days',now()-interval '31 days',now()-interval '2 days','demo-buyer',now()-interval '32 days') ON CONFLICT DO NOTHING",
  [receiptId, id(23)],
);
const snapshot = {
  receiptId,
  creatorId: "demo-creator-a",
  campaignId: saleCampaignId,
  productId,
  brandId,
  vendorId,
  commission: saleTerms.hybrid.affiliate,
};
const initialized = (
  await commerce.query('SELECT id FROM commerce."order" WHERE id=$1', [orderId])
).rows.length;
if (!initialized) {
  await commerce.query(
    `INSERT INTO commerce."order"(id,account_id,person_id,status,currency,subtotal_cents,total_cents,placed_at) VALUES($1,$2,$3,'paid','USD',50000,50000,now()-interval '31 days')`,
    [orderId, accountId, personId],
  );
  await commerce.query(
    `INSERT INTO commerce.order_line(id,order_id,account_id,person_id,product_id,vendor_id,brand_id,quantity,unit_amount_cents,line_total_cents,currency) VALUES($1,$2,$3,$4,$5,$6,$7,1,50000,50000,'USD')`,
    [lineId, orderId, accountId, personId, productId, vendorId, brandId],
  );
  await commerce.query(
    "INSERT INTO commerce.order_line_creator_attribution(order_line_id,receipt_id,snapshot) VALUES($1,$2,$3)",
    [lineId, receiptId, snapshot],
  );
  await commerce.query(
    "INSERT INTO commerce.payment(order_id,account_id,provider,provider_payment_id,status,amount_cents,currency) VALUES($1,$2,'stripe','pi_demo_sale','captured',50000,'USD')",
    [orderId, accountId],
  );
  await commerce.query(
    "INSERT INTO commerce.vendor_stripe_account(vendor_id,stripe_account_id) VALUES($1,'acct_vendor') ON CONFLICT DO NOTHING",
    [vendorId],
  );
}
await commerce.query(
  "CREATE TABLE IF NOT EXISTS commerce.local_demo_provider(id text PRIMARY KEY,kind text NOT NULL,value jsonb NOT NULL)",
);
async function providerSaved(key, kind, factory) {
  const found = (
    await commerce.query(
      "SELECT value FROM commerce.local_demo_provider WHERE id=$1",
      [key],
    )
  ).rows[0];
  if (found) return found.value;
  const value = await factory();
  await commerce.query(
    "INSERT INTO commerce.local_demo_provider VALUES($1,$2,$3)",
    [key, kind, value],
  );
  return value;
}
async function refunded() {
  return Number(
    (
      await commerce.query(
        "SELECT coalesce(sum(amount_cents),0)::text AS n FROM commerce.creator_refund_allocation WHERE order_id=$1",
        [orderId],
      )
    ).rows[0].n,
  );
}
let failNext = false,
  disputed = false;
const charge = async () => ({
  id: "ch_demo_sale",
  amount: 50000,
  currency: "usd",
  payment_intent: "pi_demo_sale",
  paid: true,
  captured: true,
  disputed,
  amount_refunded: await refunded(),
});
const stripe = {
  accounts: {
    retrieve: async (x) => ({
      id: x ?? "acct_platform",
      payouts_enabled: true,
      details_submitted: true,
      capabilities: { transfers: "active" },
    }),
  },
  charges: { retrieve: charge },
  paymentIntents: {
    retrieve: async () => ({
      id: "pi_demo_sale",
      status: "succeeded",
      amount_received: 50000,
      currency: "usd",
      latest_charge: await charge(),
    }),
  },
  refunds: {
    list: async () => ({
      has_more: false,
      data: (
        await commerce.query(
          "SELECT * FROM commerce.creator_refund_allocation WHERE order_id=$1",
          [orderId],
        )
      ).rows.map((r) => ({
        id: r.refund_id,
        amount: Number(r.amount_cents),
        currency: "usd",
        charge: "ch_demo_sale",
        status: "succeeded",
      })),
    }),
  },
  transfers: {
    create: async (args, { idempotencyKey }) => {
      const value = await providerSaved(
        idempotencyKey,
        "transfer",
        async () => ({
          id: `tr_demo${randomUUID().replaceAll("-", "")}`,
          ...args,
          amount_reversed: 0,
        }),
      );
      if (failNext) {
        failNext = false;
        throw new Error(
          "DEMO: response lost after provider transfer. Retry the same operation.",
        );
      }
      return value;
    },
    retrieve: async (x) =>
      (
        await commerce.query(
          "SELECT value FROM commerce.local_demo_provider WHERE kind='transfer' AND value->>'id'=$1",
          [x],
        )
      ).rows[0]?.value,
    createReversal: async (x, args, { idempotencyKey }) =>
      providerSaved(idempotencyKey, "reversal", async () => {
        const row = (
          await commerce.query(
            "SELECT * FROM commerce.local_demo_provider WHERE kind='transfer' AND value->>'id'=$1",
            [x],
          )
        ).rows[0];
        if (!row) throw new Error("Demo transfer missing");
        await commerce.query(
          "UPDATE commerce.local_demo_provider SET value=jsonb_set(value,'{amount_reversed}',to_jsonb(($2)::integer)) WHERE id=$1",
          [row.id, row.value.amount_reversed + args.amount],
        );
        return {
          id: `trr_demo${randomUUID().replaceAll("-", "")}`,
          transfer: x,
          currency: "usd",
          ...args,
        };
      }),
    retrieveReversal: async (x, y) =>
      (
        await commerce.query(
          "SELECT value FROM commerce.local_demo_provider WHERE kind='reversal' AND value->>'id'=$1 AND value->>'transfer'=$2",
          [y, x],
        )
      ).rows[0]?.value,
  },
};
const config = {
  get: (k) =>
    k === "SETTLEMENT_MINIMUM_DAYS"
      ? 30
      : k === "SETTLEMENT_PLATFORM_ACCOUNT_ID"
        ? "acct_platform"
        : k === "SETTLEMENT_OPERATOR_USER_IDS"
          ? "demo-brand"
          : true,
};
const delivery = new CommissionDeliveryService(commerce, config);
delivery.stripe = () => stripe;
const settlement = new CreatorSettlementService(commerce, config, delivery);
settlement.stripe = () => stripe;
if (!initialized)
  await new PostgresVendorSplitRepository(
    commerce,
    config,
  ).upsertPayableSplitsForOrder(orderId, accountId, 200);
const fundingGateway = {
  execute: async (op) =>
    providerSaved(
      `fund:${op.id}${op.args.refundRetryId ?? ""}`,
      "fund",
      async () => ({
        id: `demo_${op.kind}_${op.id}`,
        chargeId: op.kind === "deposit" ? `demo_charge_${op.id}` : undefined,
      }),
    ),
  verifyRecovery: async (op, pid) => {
    const row = (
      await commerce.query(
        "SELECT value FROM commerce.local_demo_provider WHERE kind='fund' AND value->>'id'=$1",
        [pid],
      )
    ).rows[0];
    if (!row || pid !== `demo_${op.kind}_${op.id}`)
      throw new Error("Demo provider evidence mismatch");
    return row.value;
  },
  verifyFailedRefund: async () => {
    throw new Error("This demo refund is not failed");
  },
  depositAction: async () => ({ status: "succeeded" }),
};
const billing = {
    resolveCampaignFundingChargeContext: async () => ({
      stripeConfigured: true,
      customerId: "cus_demo",
      paymentMethodId: "pm_demo",
    }),
  },
  connect = {
    getCreatorPayoutReadiness: async () => ({
      ready: true,
      accountId: "acct_creator",
    }),
  };
const funding = new CampaignFundingService(
  db,
  config,
  billing,
  connect,
  fundingGateway,
);
const actor = { sub: "demo-brand", role: "brand" };
const { CommissionEarningsService } = api(
  "commission-earnings/commission-earnings.service.js",
);
const ledger = new CommissionEarningsService(db, config);
const bridge = new CommissionSettlementService(db, config, connect);
bridge.platform = async () => "acct_platform";
bridge.commerce = async (action, b) => {
  if (action === "platform") return { accountId: await settlement.platform() };
  if (action === "preview")
    return settlement.preview(b.orderLineId, b.receiptId);
  if (action === "decide") return settlement.decide(b);
  if (action === "retry")
    return settlement.retry(b.orderLineId, b.receiptId, b.operationId);
  if (action === "recover")
    return settlement.recover(
      b.orderLineId,
      b.receiptId,
      b.operationId,
      b.providerId,
      b.actorId,
      b.reason,
    );
  throw new Error("Unknown demo settlement action");
};
async function sync() {
  const p = await settlement.preview(lineId, receiptId);
  const event = (
    await commerce.query(
      "SELECT * FROM commerce.creator_earning_outbox WHERE order_line_id=$1 ORDER BY revision DESC LIMIT 1",
      [lineId],
    )
  ).rows[0];
  await ledger.ingest({
    ...event.payload,
    eventId: event.event_id,
    revision: event.revision,
  });
  return p;
}
await sync();
async function route(req, b) {
  const u = new URL(req.url, "http://127.0.0.1");
  const p = u.pathname.replace(/^\/v1/, "");
  if (p === "/local-demo") {
    return {
      campaignId,
      saleCampaignId,
      lineId,
      workspace,
      provider: "SIMULATED MONEY",
      database: "Docker PostgreSQL",
      ...(await sync()),
    };
  }
  if (p === "/local-demo/refund") {
    const existing = await refunded();
    if (existing >= 50000) throw new Error("Demo order fully refunded");
    const amount = Math.min(10000, 50000 - existing);
    await commerce.query(
      `INSERT INTO commerce.creator_refund_allocation(refund_id,order_id,amount_cents,currency,provider_payment_id,actor_id,reason,lines) VALUES($1,$2,$3,'USD','pi_demo_sale','demo-operator','Simulated customer refund',$4)`,
      [
        `re_demo${randomUUID().replaceAll("-", "")}`,
        orderId,
        amount,
        JSON.stringify([
          {
            orderLineId: lineId,
            quantity: 0,
            netCents: amount,
            taxCents: 0,
            shippingCents: 0,
          },
        ]),
      ],
    );
    return sync();
  }
  if (p === "/local-demo/fail-next") {
    failNext = true;
    return { armed: true };
  }
  if (p === "/local-demo/dispute") {
    disputed = !disputed;
    return sync();
  }
  if (p === "/local-demo/accept-creators") {
    for (const [uid, name, n] of [
      ["demo-creator-a", "Ada — Demo Creator", 21],
      ["demo-creator-b", "Ben — Demo Creator", 22],
    ])
      await invites.createAcceptanceSnapshot({
        campaignId,
        brandUserId: "demo-brand",
        creatorUserId: uid,
        creatorEmail: `${uid}@example.test`,
        creatorName: name,
        source: "campaign_invite",
        sourceId: id(n),
      });
    return funding.status(actor.sub, campaignId);
  }
  if (p === "/settings") return { compactSidebar: false };
  if (p === "/brand-workspaces")
    return [
      {
        id: workspace,
        name: "Demo Brand",
        role: "owner",
        isDefault: true,
        canCreate: false,
      },
    ];
  if (p === "/campaigns")
    return { campaigns: await repository.listByOwner(actor.sub) };
  if (p.startsWith("/invites/campaign")) return { invites: [] };
  if (p.startsWith("/campaigns/") && p.endsWith("/payouts"))
    return { payouts: [] };
  if (p.startsWith("/campaigns/") && req.method === "PUT") {
    const cid = p.split("/")[2];
    await funding.beforeSave(b, cid);
    const current = await repository.getByIdForOwner(actor.sub, cid);
    b.payment.promotedProduct = current.payment.promotedProduct;
    return repository.update(actor.sub, cid, b);
  }
  if (p.startsWith("/campaign-funding/")) {
    const [, _, cid, action] = p.split("/");
    if (!action) return funding.status(actor.sub, cid);
    if (action === "deposit")
      return funding.deposit(actor.sub, cid, b.expectedAmountCents);
    if (action === "accept-work") {
      await funding.acceptWork(actor.sub, cid, b.obligationId, b.note);
      await funding.tick();
      return funding.status(actor.sub, cid);
    }
    if (action === "retry") return funding.retry(actor.sub, cid, b.operationId);
    if (action === "recover")
      return funding.recover(
        actor.sub,
        cid,
        b.operationId,
        b.providerId,
        b.reason,
        b.mode === "retry_refund",
      );
    if (action === "cancel-obligation") {
      await funding.cancelObligation(actor.sub, cid, b.obligationId, b.note);
      await funding.tick();
      return { cancelled: true };
    }
    if (action === "deposit-action") return { status: "succeeded" };
  }
  if (p.startsWith("/commission-settlement/")) {
    await sync();
    const [, _, line, action] = p.split("/");
    if (!action) return bridge.preview(actor, line);
    if (action === "decide") return bridge.decide(actor, line, b);
    if (action === "replay") return bridge.replay(actor, line, b.requestId);
    if (action === "retry") return bridge.retry(actor, line, b.operationId);
    if (action === "recover")
      return bridge.recover(actor, line, b.operationId, b.providerId, b.reason);
  }
  if (p === "/commission-earnings") {
    const s = await sync();
    return {
      notice: "Local demo",
      totals: [
        {
          currency: "USD",
          attributedLines: 1,
          reversedLines: s.earnedCents === 0 ? 1 : 0,
          heldLines: s.holdReasons.length ? 1 : 0,
          underReviewCents: s.holdReasons.length ? "0" : String(s.earnedCents),
          heldCents: s.holdReasons.length ? String(s.earnedCents) : "0",
        },
      ],
      lines: [
        {
          orderLineId: lineId,
          campaignId: saleCampaignId,
          currency: "USD",
          accruedCents: String(s.earnedCents),
          state: s.holdReasons.length ? "held" : "under_review",
          reasons: s.holdReasons,
          updatedAt: new Date().toISOString(),
        },
      ],
      limit: 100,
    };
  }
  return {};
}
const server = http.createServer(async (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  try {
    if (
      !["127.0.0.1", "localhost"].includes(
        new URL(`http://${req.headers.host}`).hostname,
      )
    )
      throw new Error("Local demo only");
    const origin = req.headers.origin;
    if (
      origin &&
      !["http://127.0.0.1:3011", "http://localhost:3011"].includes(origin)
    )
      throw new Error("Local origin required");
    let raw = "";
    for await (const c of req) {
      raw += c;
      if (raw.length > 100000) throw new Error("Payload too large");
    }
    const body = raw ? JSON.parse(raw) : {};
    const data = await workspaceContext.run(
      {
        workspaceId: workspace,
        actorUserId: actor.sub,
        role: "owner",
        isDefault: true,
      },
      () => route(req, body),
    );
    res.end(JSON.stringify({ data }));
  } catch (e) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: { message: e.cause?.message ?? e.message },
        message: e.cause?.message ?? e.message,
      }),
    );
  }
});
server.listen(5011, "127.0.0.1", () =>
  console.log(
    "Local demo API ready on http://127.0.0.1:5011 — Docker databases, simulated provider only",
  ),
);
const timer = setInterval(() => void funding.tick(), 1000);
timer.unref();
process.on("SIGTERM", () => {
  server.close();
  clearInterval(timer);
  void Promise.all([pg.end(), commerce.end()]);
});
