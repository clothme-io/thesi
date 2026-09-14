import assert from "node:assert/strict";
import path from "node:path";
import { randomUUID } from "node:crypto";
export async function verifySalesReserve({
  root,
  customerRequire,
  commerce,
  pool,
  order,
  attrs,
}) {
  const { PostgresVendorSplitRepository } = customerRequire(
    path.resolve(
      root,
      "../customer-api/dist/modules/commerce/infrastructure/postgres-vendor-split.repository.js",
    ),
  );
  const receipt = structuredClone(attrs[0].snapshot);
  Object.assign(receipt.commission, {
    fundingFlowVersion: 1,
    payoutHandler: "clothme",
    fundingSource: "brand",
  });
  await commerce.query(
    "UPDATE commerce.order_line_creator_attribution SET snapshot=$1 WHERE order_line_id=$2",
    [receipt, attrs[0].order_line_id],
  );
  await commerce.query(
    "UPDATE commerce.\"order\" SET status='paid' WHERE id=$1",
    [order.id],
  );
  await commerce.query(
    "UPDATE commerce.order_line SET line_total_cents=unit_amount_cents*quantity WHERE order_id=$1",
    [order.id],
  );
  await commerce.query(
    'UPDATE commerce."order" SET subtotal_cents=20000,total_cents=20000 WHERE id=$1',
    [order.id],
  );
  let enabled = false;
  const repository = new PostgresVendorSplitRepository(pool, {
    get: () => enabled,
  });
  await assert.rejects(
    repository.upsertPayableSplitsForOrder(order.id, order.accountId, 200),
    /requires creator sales reserves/,
  );
  assert.equal(
    (
      await commerce.query(
        "SELECT count(*)::int AS n FROM commerce.vendor_payout_transfer",
      )
    ).rows[0].n,
    0,
  );
  enabled = true;
  const result = await repository.upsertPayableSplitsForOrder(
    order.id,
    order.accountId,
    200,
  );
  const r = (
    await commerce.query("SELECT * FROM commerce.creator_sales_reserve")
  ).rows;
  assert.equal(r.length, 1);
  assert.equal(Number(r[0].amount_cents), 500);
  const vendor = result.find((s) => s.vendorId === receipt.vendorId);
  assert.equal(
    vendor.vendorPayoutCents,
    vendor.subtotalCents +
      vendor.taxCents +
      vendor.shippingCents -
      vendor.platformFeeCents -
      500,
  );
  assert.deepEqual(
    await repository.upsertPayableSplitsForOrder(
      order.id,
      order.accountId,
      200,
    ),
    result,
  );
  assert.equal(
    (
      await commerce.query(
        "SELECT count(*)::int AS n FROM commerce.creator_sales_reserve",
      )
    ).rows[0].n,
    1,
  );
  await assert.rejects(
    commerce.query("UPDATE commerce.creator_sales_reserve SET amount_cents=0"),
    /immutable/,
  );
  receipt.commission.commissionPercent = 100;
  await commerce.query(
    "UPDATE commerce.order_line_creator_attribution SET snapshot=$1 WHERE order_line_id=$2",
    [receipt, attrs[0].order_line_id],
  );
  await assert.rejects(
    repository.upsertPayableSplitsForOrder(order.id, order.accountId, 200),
    /reconciliation/,
  );
  if (process.argv.includes("--settlement")) {
    const { verifySettlement } = await import("./verify-settlement.mjs");
    await verifySettlement({
      root,
      customerRequire,
      commerce,
      pool,
      order,
      attrs,
    });
  }
  // A distinct discounted order keeps tax/shipping out of the commission base.
  const discountedOrder = randomUUID(),
    discountedLine = randomUUID(),
    discountedReceipt = randomUUID();
  const source = (
    await commerce.query("SELECT * FROM commerce.order_line WHERE id=$1", [
      attrs[0].order_line_id,
    ])
  ).rows[0];
  const discountedSnapshot = {
    ...receipt,
    receiptId: discountedReceipt,
    commission: { ...receipt.commission, commissionPercent: 10 },
  };
  await commerce.query(
    `INSERT INTO commerce."order"(id,account_id,person_id,status,currency,subtotal_cents,discount_cents,tax_cents,shipping_cents,total_cents) VALUES($1,$2,$3,'paid','USD',10000,2000,800,500,9300)`,
    [discountedOrder, source.account_id, source.person_id],
  );
  await commerce.query(
    `INSERT INTO commerce.order_line(id,order_id,account_id,person_id,product_id,vendor_id,brand_id,quantity,unit_amount_cents,discount_cents,tax_cents,shipping_cents,line_total_cents,currency) VALUES($1,$2,$3,$4,$5,$6,$7,1,10000,2000,800,500,9300,'USD')`,
    [
      discountedLine,
      discountedOrder,
      source.account_id,
      source.person_id,
      source.product_id,
      source.vendor_id,
      source.brand_id,
    ],
  );
  await commerce.query(
    "INSERT INTO commerce.order_line_creator_attribution(order_line_id,receipt_id,snapshot) VALUES($1,$2,$3)",
    [discountedLine, discountedReceipt, discountedSnapshot],
  );
  const [discountedSplit] = await repository.upsertPayableSplitsForOrder(
    discountedOrder,
    source.account_id,
    200,
  );
  assert.equal(discountedSplit.platformFeeCents, 160);
  assert.equal(discountedSplit.vendorPayoutCents, 8340);
  assert.equal(
    Number(
      (
        await commerce.query(
          "SELECT amount_cents FROM commerce.creator_sales_reserve WHERE order_line_id=$1",
          [discountedLine],
        )
      ).rows[0].amount_cents,
    ),
    800,
  );
  assert.deepEqual(
    await repository.upsertPayableSplitsForOrder(
      discountedOrder,
      source.account_id,
      200,
    ),
    [discountedSplit],
  );
  console.log(
    "PASS: discounted merchandise commission and platform fee exclude tax/shipping and replay without changing vendor proceeds.",
  );
  console.log(
    "PASS: sales reserve required before vendor payout, exact commission withheld from vendor proceeds, replay creates no second reserve, immutable allocation, changed accepted terms held for reconciliation.",
  );
}
