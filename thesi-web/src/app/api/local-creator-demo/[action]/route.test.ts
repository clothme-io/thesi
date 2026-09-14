import { NextRequest } from 'next/server';
import { afterEach,describe,it,expect,vi } from 'vitest';
import { GET,POST } from './route';
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('local creator demo isolation',()=>{
  it('cannot activate in production even when the demo flag is set',async()=>{
    vi.stubEnv('NODE_ENV','production');vi.stubEnv('THESI_LOCAL_CREATOR_DEMO','true');
    expect((await GET(new NextRequest('http://localhost:3016/api/local-creator-demo/state'),{params:Promise.resolve({action:'state'})})).status).toBe(404);
  });
  it('rejects foreign origins before touching the demo service',async()=>{
    vi.stubEnv('NODE_ENV','development');vi.stubEnv('THESI_LOCAL_CREATOR_DEMO','true');const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
    const request=new NextRequest('http://localhost:3016/api/local-creator-demo/checkout',{method:'POST',headers:{origin:'https://evil.test',host:'localhost:3016'},body:'{}'});
    expect((await POST(request,{params:Promise.resolve({action:'checkout'})})).status).toBe(403);expect(fetcher).not.toHaveBeenCalled();
  });
});
