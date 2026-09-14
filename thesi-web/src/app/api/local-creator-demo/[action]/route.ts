import { NextRequest } from 'next/server';
const enabled=()=>process.env.NODE_ENV!=='production'&&process.env.THESI_LOCAL_CREATOR_DEMO==='true';
async function proxy(request:NextRequest,context:{params:Promise<{action:string}>}) {
  if(!enabled())return Response.json({message:'Not found'},{status:404});
  const {action}=await context.params;
  if(!['state','login','logout','prepare','claim','checkout'].includes(action))return Response.json({message:'Not found'},{status:404});
  if((action==='state')!==(request.method==='GET'))return Response.json({message:'Method not allowed'},{status:405});
  const origin=request.headers.get('origin');
  if(request.method==='POST'&&(!origin||!['http://127.0.0.1:3016','http://localhost:3016'].includes(origin)||new URL(origin).host!==request.headers.get('host')))return Response.json({message:'Origin mismatch'},{status:403});
  try {
    const body=request.method==='POST'?await request.text():undefined;
    if(body&&body.length>4096)return Response.json({message:'Too large'},{status:413});
    const response=await fetch(`http://127.0.0.1:5036/${action}`,{method:request.method,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000),headers:{'Content-Type':'application/json','X-Local-Creator-Demo':'local-only',Authorization:request.headers.get('authorization')??''},body});
    return Response.json(await response.json(),{status:response.status,headers:{'Cache-Control':'no-store'}});
  } catch {return Response.json({message:'Start the local creator demo API first.'},{status:503});}
}
export const GET=proxy;
export const POST=proxy;
