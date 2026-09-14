import http from 'node:http';
import { randomBytes } from 'node:crypto';

// Loopback-only demonstration using actual tracking/commerce services and disposable DBs.
// Login is a fixture. No payment capture or provider request is made.
export async function serveCreatorDemo({tracking,customer,commerce,PostgresOrderRepository,pool,code,id,multi}) {
  const sessions=new Set();
  const knownUsers=new Map();
  const baseSetup = {
    stripe:{id:'d',publicKey:'pk_test_demo',secret:'sk_test_demo'},
    uber:{id:'d',clientId:'demo',customerId:'demo',clientSecret:'demo'},
    google:{id:'d',secret:'demo'},
    shippo:{id:'d',secret:'demo'},
    socketi:{id:'d',appId:'demo',appSecret:'demo',appKey:'demo'},
    isCodeRequired:'true',
    expoPublicBugSinkDsn:'',
    expoPublicDatadogClientToken:'',
    expoPublicDatadogAppId:'',
    expoPublicDatadogEnv:'',
    sentryLogLevel:'fatal',
    sentryDisableAutoUpload:false,
    sentryAllowFailure:false,
    createdAt:new Date().toISOString(),
    updatedAt:new Date().toISOString(),
    version:0,
  };
  let checkout;
  const server=http.createServer(async(req,res)=>{
    const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
    try {
      if(!['127.0.0.1:5036','localhost:5036'].includes(req.headers.host))return send(403,{message:'Local demo only'});
      if(req.headers['x-local-creator-demo']!=='local-only')return send(403,{message:'Local demo only'});
      const pathname = new URL(req.url,'http://127.0.0.1:5036').pathname;
      let input={};
      if(req.method==='POST'){
        let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>4096)return send(413,{message:'Too large'});}
        input=JSON.parse(raw||'{}');
      }
      if(req.method==='GET'&&req.url==='/state'){
        const preview=await tracking.preview(code);
        return send(200,{code,product:preview,orders:Number((await commerce.query('SELECT count(*) AS n FROM commerce."order"')).rows[0]?.n??0),payments:Number((await commerce.query('SELECT count(*) AS n FROM commerce.payment')).rows[0]?.n??0)});
      }
      if(req.url==='/v1/account/apis-setup'&&req.method==='GET'){
        return send(200,{status:200,error:null,result:baseSetup});
      }
      if(req.url==='/v1/customer/me'&&req.method==='GET'){
        const token=req.headers.authorization?.replace('Bearer ','')||'';
        const user=knownUsers.get(token);
        if(!user)return send(401,{status:401,error:{status:401,message:'Unauthorized'}});
        return send(200,{result:{accountId:user.accountId,accountUserId:user.personId,firstName:'Demo',lastName:'User',gender:'other',dob:'1990-01-01',profileAvatar:'',email:`${user.accountId}@example.test`,city:'',country:'',state:'',zipCode:'',continent:'',relationship:'',height:170,updatedAt:new Date().toISOString(),version:0,users:[{userId:user.personId,firstName:'Demo',lastName:'User',profileAvatar:'',gender:'other',dob:'1990-01-01',height:170,relationship:'',updatedAt:new Date().toISOString(),version:0}],wishbags:{wishbagId:`${user.accountId}-wish`,updatedAt:new Date().toISOString(),version:0,wishbagItems:[]},favoriteBrands:[],settings:{}}});
      }
      if(pathname.startsWith('/v1/customer/creator-attribution/')&&req.method==='POST'){
        const section=pathname.split('/').at(-1);
        if(section==='prepare'){
          if(input.code!==code)return send(404,{message:'Creator link unavailable'});
          return send(200,{result:await customer.prepare(input.code)});
        }
        if(section==='claim'){
          const claimed=await customer.claim(id(10),id(11),input.code);
          return send(200,{result:claimed});
        }
      }
      if(req.url==='/v1/auth/refresh'&&req.method==='POST'){
        return send(200,{accessToken:'demo-access',refreshToken:'demo-refresh',user:{id:'demo-user'}});
      }
      if(req.url.startsWith('/v1/auth/')&&req.method==='POST'){
        const token=`demo-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const accountId=`account-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        const personId=`person-${Date.now()}-${Math.random().toString(16).slice(2)}`;
        sessions.add(token);
        knownUsers.set(token,{accountId,personId});
        return send(200,{accessToken:token,refreshToken:`refresh-${token}`,user:{id:accountId}});
      }
      if(req.method!=='POST')return send(404,{message:'Unavailable'});
      if(req.url==='/login'){const token=randomBytes(24).toString('hex');sessions.add(token);return send(200,{token,name:'Demo shopper'});}
      if(!sessions.has(req.headers.authorization?.replace('Bearer ','')))return send(401,{message:'Sign in to the local demo first.'});
      if(req.url==='/logout'){sessions.delete(req.headers.authorization.replace('Bearer ',''));return send(200,{ok:true});}
      if(req.url==='/prepare'){
        if(input.code!==code)return send(404,{message:'Creator link unavailable'});
        return send(200,await customer.prepare(input.code));
      }
      if(req.url==='/claim')return send(200,await customer.claim(id(10),id(11),input.code));
      if(req.url==='/checkout'){
        if(!checkout)checkout=(async()=>{
          const receipts=await customer.forCheckout(id(10),id(11),[id(3)]);
          if(!receipts.length)throw Error('Continue through the creator link before ordering.');
          const [cart]=(await commerce.query('INSERT INTO commerce.cart(account_id,person_id) VALUES($1,$2) RETURNING id',[id(10),id(11)])).rows;
          await commerce.query('INSERT INTO commerce.cart_item(cart_id,account_id,person_id,product_id,vendor_id,brand_id,quantity,unit_amount_cents,variant_id) VALUES($1,$2,$3,$4,$5,$6,1,5000,$7)',[cart.id,id(10),id(11),id(3),id(1),id(2),multi?id(30):null]);
          const order=await new PostgresOrderRepository(pool).placeOrder({accountId:id(10),personId:id(11),cartId:cart.id,attributions:receipts});
          const rows=(await commerce.query('SELECT a.snapshot FROM commerce.order_line_creator_attribution a JOIN commerce.order_line l ON l.id=a.order_line_id WHERE l.order_id=$1',[order.id])).rows;
          return {orderId:order.id,status:order.status,creatorId:rows[0]?.snapshot.creatorId,productId:rows[0]?.snapshot.productId,brandId:rows[0]?.snapshot.brandId,amountCents:5000,payments:0};
        })().catch(error=>{checkout=undefined;throw error;});
        return send(200,await checkout);
      }
      send(404,{message:'Unavailable'});
    } catch(error){send(error.getStatus?.()??400,{message:error.message});}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(5036,'127.0.0.1',resolve);});
  console.log('Creator-link Docker demo API ready on http://127.0.0.1:5036. Fixture login; no payment provider.');
  await new Promise(resolve=>{process.once('SIGINT',resolve);process.once('SIGTERM',resolve);});
  await new Promise(resolve=>server.close(resolve));
}
