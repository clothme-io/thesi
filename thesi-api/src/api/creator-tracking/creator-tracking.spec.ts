import { AttributionServiceGuard } from './creator-tracking.controller';
import { CreatorTrackingService,clickDigest } from './creator-tracking.service';
describe('creator attribution boundary',()=>{
  it('uses a dedicated, server-only credential and fails paused verification explicitly',()=>{
    const key='a'.repeat(32);const config={get:(k:string)=>k==='CREATOR_TRACKING_ENABLED'?true:key};
    const guard=new AttributionServiceGuard(config as any);
    const context=(value:unknown)=>({switchToHttp:()=>({getRequest:()=>({headers:{'x-thesi-attribution-key':value}})})}) as any;
    expect(guard.canActivate(context(key))).toBe(true);
    for(const value of [undefined,'wrong',[key],'é'.repeat(32)])expect(()=>guard.canActivate(context(value))).toThrow();
    expect(()=>new AttributionServiceGuard({get:()=>false} as any).canActivate(context(key))).toThrow('paused');
  });
  it('does not query new tables when discovery is disabled',async()=>{
    const execute=jest.fn();const service=new CreatorTrackingService({execute} as any,{get:()=>false} as any,{} as any);
    expect(await service.mine('creator')).toEqual({enabled:false,campaigns:[]});
    await expect(service.issue('creator','campaign')).rejects.toThrow('unavailable');
    expect(execute).not.toHaveBeenCalled();
  });
  it('requires the new migration only on activation',async()=>{
    const service=new CreatorTrackingService({execute:async()=>({rows:[{ready:false}]})} as any,{get:()=>true} as any,{} as any);
    await expect(service.onApplicationBootstrap()).rejects.toThrow('V36');
  });
  it('can pause new handoffs independently of existing receipt verification',async()=>{
    const service=new CreatorTrackingService({} as any,{get:(k:string)=>k==='CREATOR_TRACKING_ENABLED'} as any,{} as any);
    await expect(service.click('a'.repeat(43))).rejects.toThrow('New creator links are paused');
    await expect(service.issue('creator','campaign')).rejects.toThrow('New creator links are paused');
  });
  it('stores a digest rather than the handoff code',()=>{const code='a'.repeat(43);expect(clickDigest(code)).not.toBe(code);expect(clickDigest(code)).toHaveLength(43);});
});
