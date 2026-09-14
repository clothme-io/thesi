// Used by the isolated Docker/Nest HTTP harness with --products.
import assert from 'node:assert/strict';
export async function verifyProducts({catalog,pg,session,brand,vendorId,th,id,browser}){
 await catalog.query("UPDATE catalog.vendor SET status='active' WHERE id=$1",[vendorId]);
 await catalog.query('UPDATE catalog.brand SET is_published=true WHERE id=$1',[brand.id]);
 const selected=[];
 for(const [n,title] of [[40,'Linen shirt'],[50,'Denim trousers']]){
  await catalog.query(`INSERT INTO catalog.product(id,brand_id,vendor_id,title,product_type,sku,status,is_published) VALUES($1,$2,$3,$4,'CLOTHING',$4,'active',true)`,[id(n),brand.id,vendorId,title]);
  await catalog.query(`INSERT INTO catalog.product_color(id,product_id,brand_id,vendor_id,name) VALUES($1,$2,$3,$4,'Blue')`,[id(n+1),id(n),brand.id,vendorId]);
  for(const [offset,size,price] of [[2,'M',3000],[3,'L',3500],[4,'XL',4000]])await catalog.query(`INSERT INTO catalog.variant(id,product_id,product_color_id,brand_id,vendor_id,size_label,quantity,price_cents) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,[id(n+offset),id(n),id(n+1),brand.id,vendorId,size,offset===4?0:10,price]);
  selected.push({productId:id(n),variantIds:[id(n+2)]});
 }
 const list=await th('campaigns/products',undefined,session.accessToken,200);
 assert.equal(list.products.length,2);assert.ok(list.products.every(p=>p.variants.length===2));
 const draft={name:'Two-product agreement',campaignType:'product',status:'draft',postToMarketplace:false,payment:{model:'commission',hybrid:{affiliate:{enabled:true,commissionType:'percentage_of_sale',commissionPercent:10,currency:'USD',attributionWindowDays:30,terms:'Qualifying sales after returns'}}},merchantProducts:selected};
 const saved=await th('campaigns',draft,session.accessToken);
 assert.equal(saved.payment.promotedProducts.length,2);assert.equal(saved.payment.promotedProducts[0].variants[0].priceCents,3000);
 await th('campaigns',{...draft,merchantProducts:[{productId:id(40),variantIds:[id(54)]}]},session.accessToken,400);
 await th('campaigns',{...draft,payment:{...draft.payment,promotedProducts:list.products}},session.accessToken,400);
 await th('campaigns',{...draft,merchantProducts:[{productId:id(999)}]},session.accessToken,400);
 // Simulate an already-published agreement so mutation guards are exercised
 // without invoking external platform-fee collection in this catalog test.
 await pg.query("UPDATE thesi.campaign SET status='active' WHERE id=$1",[saved.id]);
 const update=async(body,expected)=>{
  const r=await fetch(`http://127.0.0.1:5013/v1/campaigns/${saved.id}`,{method:'PUT',headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.accessToken}`},body:JSON.stringify(body)});
  const data=await r.json();assert.equal(r.status,expected,JSON.stringify(data));return data.data??data;
 };
 await update({...draft,status:'paused',merchantProducts:[selected[0]]},400);
 await catalog.query('UPDATE catalog.variant SET price_cents=9900 WHERE id=$1',[id(42)]);
 const preserved=await update({...draft,status:'paused'},200);
 assert.equal(preserved.payment.promotedProducts[0].variants[0].priceCents,3000);
 // New agreements read current prices; they do not rewrite prior agreements.
 const revision=await th('campaigns',{...draft,name:'New agreement with current terms'},session.accessToken);
 assert.notEqual(revision.id,saved.id);assert.equal(revision.payment.promotedProducts[0].variants[0].priceCents,9900);
 if(browser){const {runProductBrowser}=await import('./campaign-products-browser.mjs');await runProductBrowser({session,pg});}
 console.log('PASS product HTTP: actual Merchant catalog repositories, stock filtering, multi-product save, trusted prices, foreign variants, client snapshot rejection, frozen published selection, new agreement prices.');
}
