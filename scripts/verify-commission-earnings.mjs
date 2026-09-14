// Called only by the disposable PostgreSQL attribution harness with --earnings.
import assert from 'node:assert/strict';
import path from 'node:path';
export async function verifyEarnings({root,require,customerRequire,database,query,commerce,pool,order,attrs,id,workspace,merchantLink}) {
 const {CommissionEarningsService}=require(path.join(root,'thesi-api/dist/api/commission-earnings/commission-earnings.service.js'));
 const {CommissionDeliveryService}=customerRequire(path.resolve(root,'../customer-api/dist/modules/commerce/application/commission-delivery.service.js'));
 const {RefundAllocationService}=customerRequire(path.resolve(root,'../customer-api/dist/modules/commerce/application/refund-allocation.service.js'));
 const {workspaceContext}=require(path.join(root,'thesi-api/dist/api/brand-workspaces/workspace-context.js'));
 const ledger=new CommissionEarningsService(database,{get:()=>true});await ledger.onApplicationBootstrap();
 const delivery=new CommissionDeliveryService(pool,{get:()=>true,getOrThrow:key=>key==='THESI_API_URL'?'https://thesi.test':'fixture'});
 let refund=0,refundStatus="succeeded",networkDown=false;
 delivery.stripe=()=>({paymentIntents:{retrieve:async()=>{if(networkDown)throw new Error('offline');return {id:'pi_fixture',status:'succeeded',currency:'usd',amount_received:order.totalCents,latest_charge:{id:'ch_fixture',paid:true,captured:true,payment_intent:'pi_fixture',amount:order.totalCents,currency:'usd',amount_refunded:refund,disputed:false}};}},refunds:{list:async()=>({has_more:false,data:refund?(refund===order.totalCents && refundStatus==='succeeded' ? [{id:'re_fixture',charge:'ch_fixture',currency:'usd',status:'succeeded',amount:1000},{id:'re_final',charge:'ch_fixture',currency:'usd',status:'succeeded',amount:refund-1000}] : [{id:'re_fixture',charge:'ch_fixture',currency:'usd',status:refundStatus,amount:refund}]):[]})}});
 const q=async(s,p=[])=> (await commerce.query(s,p)).rows;
 await delivery.observe(pool,order.id);assert.equal((await q('SELECT count(*)::int n FROM commerce.creator_earning_outbox'))[0].n,0,'pending order is not a sale');
 // The attribution fixture inserts cart rows directly; set reconciled monetary fixture values for this payment test.
 await q('UPDATE commerce.order_line SET line_total_cents=unit_amount_cents*quantity WHERE order_id=$1',[order.id]);
 order.totalCents=20000;
 await q('UPDATE commerce."order" SET subtotal_cents=20000,total_cents=20000 WHERE id=$1',[order.id]);
 await q(`INSERT INTO commerce.payment(order_id,account_id,provider,provider_payment_id,status,amount_cents,currency) VALUES($1,$2,'stripe','pi_fixture','captured',$3,'USD')`,[order.id,id(10),order.totalCents]);
 await q(`UPDATE commerce."order" SET status='paid' WHERE id=$1`,[order.id]);
 // Vendor fee includes both attributed and unattributed lines.
 await q(`INSERT INTO commerce.order_vendor_split(order_id,vendor_id,account_id,subtotal_cents,platform_fee_cents,currency,status) VALUES($1,$2,$3,15000,300,'USD','payable')`,[order.id,id(1),id(10)]);
 await delivery.observe(pool,order.id);await delivery.observe(pool,order.id);
 let out=(await q('SELECT * FROM commerce.creator_earning_outbox ORDER BY revision'));
 assert.equal(out.length,1,'unchanged source produces one durable event');assert.equal(out[0].payload.platformFeeCents,100,'fee includes all vendor lines');
 const event={...out[0].payload,eventId:out[0].event_id,revision:out[0].revision};
 const previousFetch=globalThis.fetch;
 try {
  globalThis.fetch=async(_url,options)=>({ok:true,json:async()=>({data:await ledger.ingest(JSON.parse(options.body))})});
  if(event.variantId){
    assert.equal(event.variantId,id(30));
    await assert.rejects(ledger.ingest({...event,eventId:id(809),variantId:id(32)}),/does not match/i);
  }
  await delivery.deliver(pool);
  assert.ok((await q('SELECT delivered_at FROM commerce.creator_earning_outbox'))[0].delivered_at);
  assert.deepEqual(await ledger.ingest(event),{accepted:true,duplicate:true});
  const report=await ledger.mine({sub:'creator',role:'creator'});assert.equal(report.totals[0].underReviewCents,'500');
  assert.equal((await ledger.mine({sub:'other',role:'creator'})).lines.length,0);
  await assert.rejects(ledger.mine({sub:'owner',role:'brand'}),/Select a brand/);
  const brand=await workspaceContext.run({workspaceId:workspace,actorUserId:'owner',role:'owner'},()=>ledger.mine({sub:'owner',role:'brand'}));assert.deepEqual(brand.totals,report.totals);
  assert.deepEqual((await workspaceContext.run({workspaceId:workspace,actorUserId:'owner',role:'viewer'},()=>ledger.mine({sub:'owner',role:'brand'}))).totals,report.totals);
  assert.deepEqual((await ledger.merchant(id(1),id(2))).totals,report.totals);
  await assert.rejects(ledger.merchant(id(99),id(2)),/not linked/);
  await assert.rejects(ledger.ingest({...event,netSaleCents:1}),/reused/);
  await assert.rejects(ledger.ingest({...event,eventId:id(801),revision:3}),/preceding/);
  await assert.rejects(ledger.ingest({...event,eventId:id(802),revision:2,receiptId:id(999)}),/cannot change/);
  await assert.rejects(query('UPDATE thesi.commission_earning_event SET accrued_cents=0'),/immutable/);
  networkDown=true;await assert.rejects(delivery.observe(pool,order.id),/offline/);networkDown=false;
  assert.equal((await q('SELECT count(*)::int n FROM commerce.creator_earning_outbox'))[0].n,1);
  refund=order.totalCents;refundStatus='pending';await delivery.observe(pool,order.id);await delivery.deliver(pool);
  const pendingReport=await ledger.mine({sub:'creator',role:'creator'});assert.equal(pendingReport.totals[0].reversedLines,0);assert.equal(pendingReport.totals[0].heldCents,'500');
  refundStatus='succeeded';refund=1000;await delivery.observe(pool,order.id);await delivery.deliver(pool);
  assert.equal((await ledger.mine({sub:'creator',role:'creator'})).totals[0].heldCents,'500');
  const allocations=new RefundAllocationService(pool,{get:()=>true});
  allocations.stripe=()=>({refunds:{retrieve:async()=>({status:'succeeded',payment_intent:'pi_fixture',currency:'usd',amount:1000})}});
  const allocation={orderId:order.id,refundId:'re_fixture',actorId:'ops-fixture',reason:'Verified return',lines:[{orderLineId:attrs[0].order_line_id,quantity:0,netCents:1000,taxCents:0,shippingCents:0}]};
  assert.deepEqual(await allocations.record(allocation),{recorded:true,duplicate:false});
  assert.deepEqual(await allocations.record(allocation),{recorded:true,duplicate:true});
  await assert.rejects(allocations.record({...allocation,reason:'Changed'}),/different allocation/);
  await assert.rejects(allocations.record({...allocation,refundId:'re_other',lines:[{...allocation.lines[0],quantity:2}]}),/quantity/);
  await assert.rejects(allocations.record({...allocation,refundId:'re_other',lines:[{...allocation.lines[0],netCents:900,taxCents:100}]}),/taxCents/);
  await assert.rejects(allocations.record({...allocation,refundId:'re_other',lines:[{...allocation.lines[0],orderLineId:id(909)}]}),/belong/);
  await assert.rejects(allocations.record({...allocation,refundId:'re_other',lines:[{...allocation.lines[0],netCents:999}]}),/equal/);
  await assert.rejects(q('DELETE FROM commerce.creator_refund_allocation'),/immutable/);
  await delivery.observe(pool,order.id);await delivery.deliver(pool);
  const adjusted=await ledger.mine({sub:'creator',role:'creator'});
  assert.equal(adjusted.totals[0].underReviewCents,'400');assert.equal(adjusted.totals[0].heldCents,'0');
  refund=order.totalCents;await delivery.observe(pool,order.id);
  globalThis.fetch=async()=>{throw new Error('unavailable');};await delivery.deliver(pool);
  out=await q('SELECT * FROM commerce.creator_earning_outbox ORDER BY revision');assert.equal(out[4].delivered_at,null);assert.equal(out[4].attempts,1);
  await q('UPDATE commerce.creator_earning_outbox SET next_attempt_at=now() WHERE delivered_at IS NULL');
  globalThis.fetch=async(_url,options)=>({ok:true,json:async()=>({data:await ledger.ingest(JSON.parse(options.body))})});
  await delivery.deliver(pool);
  const final=await ledger.mine({sub:'creator',role:'creator'});assert.equal(final.totals[0].reversedLines,1);assert.equal(final.totals[0].underReviewCents,'0');assert.equal(final.totals[0].heldCents,'0');
  assert.equal((await query('SELECT sum(adjustment_cents)::text n FROM thesi.commission_earning_event'))[0].n,'0');
  await query('UPDATE thesi.merchant_brand_link SET revoked_at=now() WHERE id=$1',[merchantLink.id]);
  await assert.rejects(ledger.merchant(id(1),id(2)),/not linked/);
  assert.equal((await ledger.mine({sub:'creator',role:'creator'})).lines.length,1,'historical earnings survive disconnect');
  assert.equal((await ledger.operations()).lines.length,1);
  console.log('PASS commission: verified source, durable retries, exact allocation, immutable ledger, duplicate/conflict/order checks, creator/workspace/Merchant boundaries, partial-refund holds and full reversals.');
 }finally{globalThis.fetch=previousFetch;}
}
