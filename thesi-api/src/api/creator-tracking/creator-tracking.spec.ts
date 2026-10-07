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
  it('binds an install claim without paying when conversion events are configured',async()=>{
    const execute=jest.fn()
      .mockResolvedValueOnce({rows:[{tracking_link_id:'l',snapshot_id:'s',creator_user_id:'creator',campaign_id:'c',workspace_id:'w',payment:{model:'app_install',hybrid:{affiliate:{enabled:true,commissionType:'fixed_amount_per_install',currency:'USD',attributionWindowDays:30,terms:'Install conversions.',installApp:'customer',conversions:[{event:'verified_account',amountCents:100}]}}}}]})
      .mockResolvedValueOnce({rows:[]})
      .mockResolvedValueOnce({rows:[{bound_at:new Date('2026-10-07T00:00:00Z'),expires_at:new Date('2026-11-06T00:00:00Z')}]});
    const service=new CreatorTrackingService({transaction:(fn:any)=>fn({execute})} as any,{get:()=>true} as any,{} as any);
    await expect(service.claimInstall('a'.repeat(43),'b'.repeat(43))).resolves.toMatchObject({
      campaignId:'c',state:'bound',accruedCents:0,
    });
    expect(JSON.stringify(execute.mock.calls)).toContain('creator_install_touchpoint');
    expect(JSON.stringify(execute.mock.calls)).not.toContain('commission_install_event');
  });
  it('records a selected conversion and ignores events the campaign did not select',async()=>{
    const paid=jest.fn()
      .mockResolvedValueOnce({rows:[{tracking_link_id:'l',snapshot_id:'s',creator_user_id:'creator',workspace_id:'w',campaign_id:'c',payment:{hybrid:{affiliate:{currency:'USD',conversions:[{event:'verified_account',amountCents:100},{event:'fit_profile_completed'}]}}}}]})
      .mockResolvedValueOnce({rows:[]})
      .mockResolvedValueOnce({rows:[{accrued_cents:'100',state:'under_review'}]});
    const ignored=jest.fn().mockResolvedValue({rows:[{tracking_link_id:'l',snapshot_id:'s',creator_user_id:'creator',workspace_id:'w',campaign_id:'c',payment:{hybrid:{affiliate:{currency:'USD',conversions:[{event:'verified_account',amountCents:100}]}}}}]});
    const service=(execute:jest.Mock)=>new CreatorTrackingService({transaction:(fn:any)=>fn({execute})} as any,{get:()=>true} as any,{} as any);
    await expect(service(paid).recordConversion('b'.repeat(43),'verified_account')).resolves.toEqual({
      applied:[{campaignId:'c',creatorId:'creator',event:'verified_account',accruedCents:100,state:'under_review'}],
    });
    await expect(service(ignored).recordConversion('b'.repeat(43),'first_purchase')).resolves.toEqual({applied:[]});
  });
  it('lists accepted sale and install campaigns with issued URLs',async()=>{
    const sale='a'.repeat(43);const install='b'.repeat(43);
    const execute=jest.fn().mockResolvedValue({rows:[
      {campaignId:'sale',name:'Summer shirt',productTitle:'Linen shirt',productId:'p1',commissionType:'percentage_of_sale',publicCode:sale},
      {campaignId:'install',name:'App install',productTitle:null,productId:null,commissionType:'fixed_amount_per_install',publicCode:install},
    ]});
    const service=new CreatorTrackingService({execute} as any,{get:(k:string)=>k==='CREATOR_TRACKING_ENABLED'||k==='CREATOR_LINKS_ENABLED'} as any,{} as any);
    await expect(service.mine('creator')).resolves.toEqual({enabled:true,campaigns:[
      {campaignId:'sale',name:'Summer shirt',productTitle:'Linen shirt',productId:'p1',commissionType:'percentage_of_sale',linkType:'sale',url:`https://clothme.io/product/p1?c=${sale}`},
      {campaignId:'install',name:'App install',productTitle:null,productId:null,commissionType:'fixed_amount_per_install',linkType:'install',url:`https://clothme.io/creator-campaign/${install}`},
    ]});
  });
});
