import { NextResponse } from 'next/server';
import { backendApiUrl } from '@/lib/backendApi';
export async function POST(request:Request,context:{params:Promise<{action:string}>}) {
 const {action}=await context.params;
 if(!['begin','inspect','finish','logout'].includes(action))return new Response(null,{status:404});
 try{
  const authorization=request.headers.get('authorization');
  const response=await fetch(backendApiUrl(`/merchant-login/${action}`),{method:'POST',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(25000),
   headers:{'Content-Type':'application/json',...(authorization?{authorization}:{})},body:JSON.stringify(await request.json())});
  return NextResponse.json(await response.json(),{status:response.status,headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:{message:'Merchant sign-in is unavailable. Please retry.'}},{status:503});}
}
