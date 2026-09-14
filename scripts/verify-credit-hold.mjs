// Standalone transaction in the disposable commerce database, rolled back after assertions.
import assert from 'node:assert/strict';
import path from 'node:path';
export async function verifyCreditHold({root,customerRequire,commerce,pool,order}){
 const {CommissionDeliveryService}=customerRequire(path.resolve(root,'../customer-api/dist/modules/commerce/application/commission-delivery.service.js'));
 const service=new CommissionDeliveryService(pool,{get:()=>true});
 service.stripe=()=>{return {paymentIntents:{retrieve:async()=>{throw new Error('Credit-only evidence must not call Stripe');}}};};
 await commerce.exec('BEGIN');
 try{
  await commerce.query("UPDATE commerce.\"order\" SET status='paid',subtotal_cents=20000,total_cents=20000 WHERE id=$1",[order.id]);
  await commerce.query('UPDATE commerce.order_line SET line_total_cents=unit_amount_cents*quantity WHERE order_id=$1',[order.id]);
  await commerce.query("INSERT INTO commerce.credit_reservation(order_id,account_id,person_id,amount_cents,status,expires_at) VALUES($1,$2,$3,20000,'captured',now()+interval '1 day')",[order.id,order.accountId,order.personId]);
  await commerce.query("INSERT INTO commerce.ledger_entry(order_id,account_id,person_id,amount_cents,entry_type,direction) VALUES($1,$2,$3,20000,'credit_spend','debit')",[order.id,order.accountId,order.personId]);
  await service.observe(pool,order.id);
  const events=(await commerce.query('SELECT payload FROM commerce.creator_earning_outbox')).rows;
  assert.equal(events.length,1);assert.ok(events[0].payload.holdReasons.includes('credit_funding_requires_review'));assert.equal(events[0].payload.evidence,'captured_credit');
  console.log('PASS: reconciled credit-only payment is explicitly held; credit funding does not masquerade as payout-ready cash.');
 }finally{await commerce.exec('ROLLBACK');}
}
