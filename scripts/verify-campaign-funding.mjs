import assert from "node:assert/strict";
import path from "node:path";
export async function verifyFunding({
  root,
  require,
  database,
  query,
  workspace,
  payment,
  id,
}) {
  const { CampaignFundingService } = require(
    path.join(
      root,
      "thesi-api/dist/api/campaign-funding/campaign-funding.service.js",
    ),
  );
  const { workspaceContext } = require(
    path.join(root, "thesi-api/dist/api/brand-workspaces/workspace-context.js"),
  );
  const { PostgresInvitesRepository } = require(
    path.join(
      root,
      "thesi-api/dist/api/invites/postgres-invites.repository.js",
    ),
  );
  const { baseFundingPlan } = require(
    path.join(root, "thesi-api/dist/api/campaign-funding/funding-plan.js"),
  );
  const terms = structuredClone(payment);
  terms.hybrid.base = {
    enabled: true,
    amountCents: 10000,
    currency: "USD",
    trigger: "content_accepted",
  };
  terms.hybrid.affiliate.fundingFlowVersion = 1;
  assert.equal(
    baseFundingPlan(
      { ...terms, hybrid: { affiliate: terms.hybrid.affiliate } },
      undefined,
    ).depositCents,
    0,
  );
  assert.throws(() => baseFundingPlan(terms, undefined), /slots/);
  assert.throws(() => baseFundingPlan(terms, 1000000));
  const [c] = await query(
    `INSERT INTO thesi.campaign(owner_user_id,workspace_id,name,campaign_type,status,start_date,end_date,payment,creator_capacity) VALUES('owner',$1,'Funded campaign','product','draft',CURRENT_DATE,CURRENT_DATE+30,$2,3) RETURNING *`,
    [workspace, terms],
  );
  await assert.rejects(
    query("UPDATE thesi.campaign SET status='active' WHERE id=$1", [c.id]),
    /funded before launch/,
  );
  const outcomes = new Map();
  let failAfterDeposit = true;
  const calls = [];
  const gateway = {
    execute: async (op) => {
      calls.push(op.id);
      if (!outcomes.has(op.id))
        outcomes.set(op.id, {
          id: `provider_${op.id}`,
          ...(op.kind === "deposit" ? { chargeId: `ch_fixture_${op.id}` } : {}),
        });
      if (op.kind === "deposit" && failAfterDeposit) {
        failAfterDeposit = false;
        throw new Error("Simulated uncertain response");
      }
      return outcomes.get(op.id);
    },
  };
  const service = new CampaignFundingService(
    database,
    { get: (key) => (key === "SETTLEMENT_OPERATOR_USER_IDS" ? "owner" : true) },
    {
      resolveCampaignFundingChargeContext: async () => ({
        stripeConfigured: true,
        customerId: "cus_fixture",
        paymentMethodId: "pm_fixture",
      }),
    },
    {
      getCreatorPayoutReadiness: async () => ({
        ready: true,
        accountId: "acct_fixture",
      }),
    },
    gateway,
  );
  await assert.rejects(service.status("owner", c.id), /workspace/);
  const asOwner = (fn) =>
    workspaceContext.run(
      { workspaceId: workspace, actorUserId: "owner", role: "owner" },
      fn,
    );
  await asOwner(async () => {
    await assert.rejects(service.deposit("owner", c.id, 100), /total changed/);
    let state = await service.deposit("owner", c.id, 30000);
    assert.equal(state.depositedCents, 0);
    assert.equal(state.fund.state, "awaiting_deposit");
    await assert.rejects(
      query("UPDATE thesi.campaign SET status='completed' WHERE id=$1", [c.id]),
      /pending deposit/,
    );
    state = await service.deposit("owner", c.id, 30000);
    assert.equal(state.depositedCents, 30000);
    assert.equal(outcomes.size, 1);
    await service.deposit("owner", c.id, 30000);
    assert.equal(calls.length, 2);
    await assert.rejects(
      query("UPDATE thesi.campaign SET creator_capacity=4 WHERE id=$1", [c.id]),
      /locked/,
    );
    await query("UPDATE thesi.campaign SET status='active' WHERE id=$1", [
      c.id,
    ]);
    const invites = new PostgresInvitesRepository(database);
    for (const n of [1, 2]) {
      await query(
        "INSERT INTO public.thesi_users(id,email,password_hash,full_name,role) VALUES($1,$2,'fixture',$1,'creator')",
        [`fundcreator${n}`, `fundcreator${n}@example.test`],
      );
      const acceptance = {
        campaignId: c.id,
        brandUserId: "owner",
        creatorUserId: `fundcreator${n}`,
        creatorEmail: `fundcreator${n}@example.test`,
        creatorName: `Creator ${n}`,
        source: "campaign_invite",
        sourceId: id(500 + n),
      };
      await invites.createAcceptanceSnapshot(acceptance);
      await invites.createAcceptanceSnapshot(acceptance);
    }
    state = await service.status("owner", c.id);
    assert.equal(state.obligations.length, 2);
    assert.equal(state.committedCents, 20000);
    assert.equal(state.unfilledSlotCents, 10000);
    const [first, second] = state.obligations;
    await assert.rejects(
      service.acceptWork("owner", c.id, first.id, ""),
      /Record/,
    );
    await service.acceptWork(
      "owner",
      c.id,
      first.id,
      "Accepted agreed video delivery",
    );
    await service.acceptWork("owner", c.id, first.id, "Duplicate request");
    await service.tick();
    state = await service.status("owner", c.id);
    assert.equal(state.releasedCents, 10000);
    assert.equal(state.heldCents, 20000);
    await query("UPDATE thesi.campaign SET status='completed' WHERE id=$1", [
      c.id,
    ]);
    await service.tick();
    state = await service.status("owner", c.id);
    assert.equal(state.refundedCents, 10000);
    assert.equal(state.heldCents, 10000);
    assert.equal(state.fund.state, "closed");
    await assert.rejects(
      query("UPDATE thesi.campaign SET status='active' WHERE id=$1", [c.id]),
      /cannot be reopened/,
    );
    await service.acceptWork(
      "owner",
      c.id,
      second.id,
      "Accepted final content after closure",
    );
    await service.tick();
    await service.tick();
    state = await service.status("owner", c.id);
    assert.equal(state.releasedCents, 20000);
    assert.equal(state.refundedCents, 10000);
    assert.equal(state.heldCents, 0);
    assert.equal(outcomes.size, 4);
    await assert.rejects(
      query(
        "UPDATE thesi.campaign_fund_entry SET amount_cents=1 WHERE campaign_id=$1",
        [c.id],
      ),
      /immutable/,
    );
  });
  const [cancelledCampaign] = await query(
    `INSERT INTO thesi.campaign(owner_user_id,workspace_id,name,campaign_type,status,start_date,end_date,payment,creator_capacity) VALUES('owner',$1,'Cancelled obligation','product','draft',CURRENT_DATE,CURRENT_DATE+30,$2,2) RETURNING *`,
    [workspace, terms],
  );
  await asOwner(async () => {
    await service.deposit("owner", cancelledCampaign.id, 20000);
    await query("UPDATE thesi.campaign SET status='active' WHERE id=$1", [
      cancelledCampaign.id,
    ]);
    await new PostgresInvitesRepository(database).createAcceptanceSnapshot({
      campaignId: cancelledCampaign.id,
      brandUserId: "owner",
      creatorUserId: "fundcreator1",
      creatorEmail: "fundcreator1@example.test",
      creatorName: "First",
      source: "campaign_invite",
      sourceId: id(570),
    });
    const obligation = (await service.status("owner", cancelledCampaign.id))
      .obligations[0];
    await assert.rejects(
      service.cancelObligation(
        "other",
        cancelledCampaign.id,
        obligation.id,
        "Verified mutual cancellation consent",
      ),
      /operator/i,
    );
    await service.cancelObligation(
      "owner",
      cancelledCampaign.id,
      obligation.id,
      "Verified mutual cancellation consent",
    );
    await service.cancelObligation(
      "owner",
      cancelledCampaign.id,
      obligation.id,
      "Verified mutual cancellation consent",
    );
    await service.tick();
    await assert.rejects(
      service.acceptWork(
        "owner",
        cancelledCampaign.id,
        obligation.id,
        "Attempted acceptance after cancellation",
      ),
      /cancelled/i,
    );
    await query("UPDATE thesi.campaign SET status='completed' WHERE id=$1", [
      cancelledCampaign.id,
    ]);
    await service.tick();
    const final = await service.status("owner", cancelledCampaign.id);
    assert.equal(final.refundedCents, 20000);
    assert.equal(final.heldCents, 0);
    assert.equal(final.releasedCents, 0);
    assert.equal(
      final.operations.filter((o) => o.kind === "refund_cancelled").length,
      1,
    );
  });
  console.log(
    "PASS: operator-only evidenced cancellation, duplicate cancellation replay, cancelled work cannot release, and closure refunds each allocated dollar only once.",
  );
  const commissionOnly = structuredClone(terms);
  delete commissionOnly.hybrid.base;
  const [only] = await query(
    `INSERT INTO thesi.campaign(owner_user_id,workspace_id,name,campaign_type,status,start_date,end_date,payment,creator_capacity) VALUES('owner',$1,'No deposit','product','active',CURRENT_DATE,CURRENT_DATE+30,$2,1) RETURNING *`,
    [workspace, commissionOnly],
  );
  await asOwner(async () => {
    assert.equal((await service.status("owner", only.id)).plan.depositCents, 0);
    await assert.rejects(
      service.deposit("owner", only.id, 1),
      /require no deposit/,
    );
  });
  const snapshots = new PostgresInvitesRepository(database);
  const acceptance = {
    campaignId: only.id,
    brandUserId: "owner",
    creatorUserId: "fundcreator1",
    creatorEmail: "fundcreator1@example.test",
    creatorName: "First",
    source: "campaign_invite",
    sourceId: id(550),
  };
  await snapshots.createAcceptanceSnapshot(acceptance);
  await snapshots.createAcceptanceSnapshot(acceptance);
  await assert.rejects(
    snapshots.createAcceptanceSnapshot({
      ...acceptance,
      creatorUserId: "fundcreator2",
      creatorEmail: "fundcreator2@example.test",
      sourceId: id(551),
    }),
    (e) => /slots are full/.test(e.cause?.message ?? e.message),
  );
  const [stale] = await query(
    `INSERT INTO thesi.campaign(owner_user_id,workspace_id,name,campaign_type,status,start_date,end_date,payment,creator_capacity) VALUES('owner',$1,'Uncertain payment','product','draft',CURRENT_DATE,CURRENT_DATE+30,$2,1) RETURNING *`,
    [workspace, terms],
  );
  await query(
    `INSERT INTO thesi.campaign_base_fund(campaign_id,workspace_id,owner_user_id,base_cents,slots,deposit_cents) VALUES($1,$2,'owner',10000,1,10000)`,
    [stale.id, workspace],
  );
  const [op] = await query(
    `INSERT INTO thesi.campaign_fund_operation(campaign_id,kind,amount_cents,first_attempt_at) VALUES($1,'deposit',10000,now()-interval '24 hours') RETURNING id`,
    [stale.id],
  );
  const before = calls.length;
  await service.process(op.id);
  assert.equal(calls.length, before);
  assert.equal(
    (
      await query(
        "SELECT state FROM thesi.campaign_fund_operation WHERE id=$1",
        [op.id],
      )
    )[0].state,
    "review",
  );
  const otherWorkspace = (
    await query(
      "SELECT id FROM thesi.brand_workspace WHERE owner_user_id='other'",
    )
  )[0].id;
  await assert.rejects(
    workspaceContext.run(
      { workspaceId: otherWorkspace, actorUserId: "owner", role: "owner" },
      () => service.status("owner", c.id),
    ),
    /not found/,
  );
  console.log(
    "PASS: base deposit × slots, launch guard, uncertain charge replay, immutable funded terms, atomic creator obligations, accepted-work release, unused-slot refund, unresolved funds retained and later released, closed campaign cannot reopen.",
  );
}
