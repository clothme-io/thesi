import assert from "node:assert/strict";
import path from "node:path";
import { randomUUID } from "node:crypto";
export async function verifySettlement({
  root,
  customerRequire,
  commerce,
  pool,
  order,
  attrs,
}) {
  const { CreatorSettlementService } = customerRequire(
    path.resolve(
      root,
      "../customer-api/dist/modules/commerce/application/creator-settlement.service.js",
    ),
  );
  const { CommissionDeliveryService } = customerRequire(
    path.resolve(
      root,
      "../customer-api/dist/modules/commerce/application/commission-delivery.service.js",
    ),
  );
  const line = attrs[0].order_line_id,
    receipt = attrs[0].receipt_id;
  const snapshot = structuredClone(attrs[0].snapshot);
  Object.assign(snapshot.commission, {
    fundingFlowVersion: 1,
    payoutHandler: "clothme",
    fundingSource: "brand",
  });
  await commerce.query(
    "UPDATE commerce.order_line_creator_attribution SET snapshot=$1 WHERE order_line_id=$2",
    [snapshot, line],
  );
  await commerce.query(
    "INSERT INTO commerce.payment(order_id,account_id,provider,provider_payment_id,status,amount_cents,currency) VALUES($1,$2,'stripe','pi_settlement','captured',20000,'USD')",
    [order.id, order.accountId],
  );
  let refunded = 0,
    failAfterTransfer = true,
    disputed = false;
  const transfers = new Map(),
    reversals = new Map();
  let count = 0;
  const charge = () => ({
    id: "ch_settlement",
    amount: 20000,
    currency: "usd",
    payment_intent: "pi_settlement",
    paid: true,
    captured: true,
    disputed,
    amount_refunded: refunded,
  });
  const stripe = {
    accounts: {
      retrieve: async (id) => ({
        id: id ?? "acct_platform",
        payouts_enabled: true,
        details_submitted: true,
        capabilities: { transfers: "active" },
      }),
    },
    paymentIntents: {
      retrieve: async () => ({
        id: "pi_settlement",
        status: "succeeded",
        amount_received: 20000,
        currency: "usd",
        latest_charge: charge(),
      }),
    },
    charges: { retrieve: async () => charge() },
    refunds: {
      list: async () => ({
        has_more: false,
        data: refunded
          ? [
              {
                id: "re_settlement",
                charge: "ch_settlement",
                currency: "usd",
                status: "succeeded",
                amount: refunded,
              },
            ]
          : [],
      }),
    },
    transfers: {
      create: async (args, { idempotencyKey }) => {
        if (!transfers.has(idempotencyKey))
          transfers.set(idempotencyKey, {
            id: `tr_${++count}`,
            ...args,
            amount_reversed: 0,
          });
        if (failAfterTransfer) {
          failAfterTransfer = false;
          throw new Error("Lost provider response");
        }
        return transfers.get(idempotencyKey);
      },
      retrieve: async (id) => [...transfers.values()].find((t) => t.id === id),
      createReversal: async (id, args, { idempotencyKey }) => {
        if (!reversals.has(idempotencyKey)) {
          const t = [...transfers.values()].find((t) => t.id === id);
          assert.ok(t);
          t.amount_reversed += args.amount;
          reversals.set(idempotencyKey, {
            id: `trr_${++count}`,
            transfer: id,
            currency: "usd",
            ...args,
          });
        }
        return reversals.get(idempotencyKey);
      },
      retrieveReversal: async (id, rid) =>
        [...reversals.values()].find((r) => r.id === rid && r.transfer === id),
    },
  };
  const config = {
    get: (key) =>
      key === "SETTLEMENT_MINIMUM_DAYS"
        ? 0
        : key === "SETTLEMENT_PLATFORM_ACCOUNT_ID"
          ? "acct_platform"
          : true,
  };
  const delivery = new CommissionDeliveryService(pool, config);
  delivery.stripe = () => stripe;
  const service = new CreatorSettlementService(pool, config, delivery);
  service.stripe = () => stripe;
  if(process.argv.includes('--rules')){
    // The settlement fixture uses an old completed review period; the live default remains 30 days.
    await commerce.query("UPDATE commerce.\"order\" SET placed_at=now()-interval '31 days' WHERE id=$1",[order.id]);
  }
  let preview = await service.preview(line, receipt);
  assert.equal(preview.earnedCents, 500);
  const decision = {
    requestId: randomUUID(),
    orderLineId: line,
    receiptId: receipt,
    expectedRevision: preview.revision,
    action: "qualify",
    reason: "Accepted campaign terms and return conditions checked",
    actorId: "owner",
    destination: "acct_creator",
    platformAccountId: "acct_platform",
  };
  if(process.argv.includes('--rules')){
    const risk={requestId:randomUUID(),orderLineId:line,receiptId:receipt,expectedRevision:preview.revision,actorId:'owner',status:'hold',kind:'suspected_self_referral',reason:'Matching referral evidence requires operator review'};
    const held=await service.reviewRisk(risk);assert.ok(held.holdReasons.includes('risk_suspected_self_referral'));
    assert.deepEqual(await service.reviewRisk(risk),held);
    await assert.rejects(service.reviewRisk({...risk,reason:'Changed'}),/reused/);
    await assert.rejects(service.decide({...decision,expectedRevision:held.revision}),/holds/);
    const clear=await service.reviewRisk({...risk,requestId:randomUUID(),expectedRevision:held.revision,actorId:'ops',status:'clear',reason:'Verified separate buyer and creator identities'});
    assert.equal(clear.holdReasons.length,0);decision.expectedRevision=clear.revision;
    await assert.rejects(commerce.query('DELETE FROM commerce.creator_risk_review'),/immutable/);
  }
  await assert.rejects(
    service.decide({ ...decision, platformAccountId: "acct_wrong" }),
    /accounts do not match/,
  );
  let state = await service.decide(decision);
  assert.equal(state.totals.creatorPaid, 0);
  assert.equal(state.operations[0].state, "pending");
  assert.equal(transfers.size, 1);
  state = await service.decide(decision);
  assert.equal(state.totals.creatorPaid, 500);
  assert.equal(transfers.size, 1);
  await assert.rejects(
    service.decide({ ...decision, reason: "Changed reason" }),
    /reused/,
  );
  disputed = true;
  await assert.rejects(
    service.decide({
      ...decision,
      requestId: randomUUID(),
      action: "reconcile",
      expectedRevision: (await service.preview(line, receipt)).revision,
    }),
    /holds/,
  );
  disputed = false;
  refunded = 1000;
  await commerce.query(
    `INSERT INTO commerce.creator_refund_allocation(refund_id,order_id,amount_cents,currency,provider_payment_id,actor_id,reason,lines) VALUES('re_settlement',$1,1000,'USD','pi_settlement','ops','Verified merchandise return',$2)`,
    [
      order.id,
      [
        {
          orderLineId: line,
          quantity: 0,
          netCents: 1000,
          taxCents: 0,
          shippingCents: 0,
        },
      ],
    ],
  );
  preview = await service.preview(line, receipt);
  assert.equal(preview.earnedCents, 400);
  const reconcile = async () => {
    const p = await service.preview(line, receipt);
    return service.decide({
      ...decision,
      requestId: randomUUID(),
      action: "reconcile",
      expectedRevision: p.revision,
    });
  };
  state = await reconcile();
  assert.equal(state.totals.creatorRecovered, 100);
  assert.equal(state.totals.refundOffset, 0);
  state = await reconcile();
  assert.equal(state.totals.refundOffset, 100);
  assert.equal(
    state.totals.vendorReturned,
    0,
    "customer refund reserve cannot also return to brand",
  );
  state = await reconcile();
  assert.equal(state.totals.creatorPaid - state.totals.creatorRecovered, 400);
  assert.equal(reversals.size, 1);
  await assert.rejects(
    commerce.query(
      "UPDATE commerce.creator_settlement_entry SET amount_cents=1",
    ),
    /immutable/,
  );
  console.log(
    "PASS: exact commission qualification, platform mismatch blocked, uncertain transfer replay, immutable approval, dispute hold, partial-refund creator recovery and refund offset without double-returning brand funds.",
  );
}
