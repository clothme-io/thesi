import { ConfigService } from '@nestjs/config';
import type { ExecutionContext } from '@nestjs/common';
import { defer, firstValueFrom } from 'rxjs';
import { WorkspaceAccessInterceptor } from './workspace-access.interceptor';
import { BrandWorkspacesService } from './brand-workspaces.service';
import { workspaceContext, workspaceResourceOwner } from './workspace-context';

const id = '10000000-0000-4000-8000-000000000001';
function context({ method = 'GET', role = 'brand', controller = 'CampaignsController', handler = 'list', selected, actor = 'brand' }: { method?: string; role?: string; controller?: string; handler?: string; selected?: unknown; actor?: string } = {}) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, user: { sub: actor, role }, headers: selected === undefined ? {} : { 'x-thesi-workspace-id': selected } }) }),
    getClass: () => ({ name: controller }), getHandler: () => ({ name: handler }),
  } as unknown as ExecutionContext;
}
function setup(enabled = true, role = 'owner', isDefault = true) {
  const resolver = { auditDelegatedAction:jest.fn(async()=>{}), resolveLegacyAccess: jest.fn(async (userId: string) => ({ workspaceId: id, actorUserId: userId, ownerUserId:'brand-owner', role, isDefault })) };
  const interceptor = new WorkspaceAccessInterceptor({ get: () => enabled } as unknown as ConfigService, resolver as unknown as BrandWorkspacesService);
  const next = { handle: jest.fn(() => defer(async () => { await Promise.resolve(); return workspaceContext.getStore(); })) };
  return { resolver, interceptor, next };
}

describe('WorkspaceAccessInterceptor', () => {
  it.each(['CampaignFundingController','CommissionSettlementController','BillingController'])('denies all staff access to %s before handler execution',async controller=>{
    const {interceptor,next}=setup(true,'member');
    await expect(interceptor.intercept(context({controller,method:'POST'}),next)).rejects.toThrow('account owner');
    expect(next.handle).not.toHaveBeenCalled();
  });
  it('records the real staff actor and resolves the resource owner without replacing the actor',async()=>{
    const {interceptor,resolver}=setup(true,'member');
    const next={handle:()=>defer(async()=>({actor:workspaceContext.getStore()?.actorUserId,owner:workspaceResourceOwner('staff-user')}))};
    expect(await firstValueFrom(await interceptor.intercept(context({actor:'staff-user',method:'POST',handler:'create'}),next))).toEqual({actor:'staff-user',owner:'brand-owner'});
    expect(resolver.auditDelegatedAction).toHaveBeenCalledWith(expect.objectContaining({actorUserId:'staff-user',workspaceId:id}),'CampaignsController','create');
  });
  it('blocks profile changes for campaign managers',async()=>{
    const {interceptor,next}=setup(true,'member');
    await expect(interceptor.intercept(context({controller:'ProfilesController',method:'PATCH'}),next)).rejects.toThrow('brand settings');
    expect(next.handle).not.toHaveBeenCalled();
  });
  it('rejects a second workspace on a Merchant-bound session',async()=>{
    const {interceptor,resolver,next}=setup();
    const ctx=context({selected:id});
    ctx.switchToHttp=()=>({getRequest:()=>({method:'GET',headers:{'x-thesi-workspace-id':id},user:{sub:'owner',role:'brand',merchantWorkspaceId:'other'}})}) as any;
    await expect(interceptor.intercept(ctx,next)).rejects.toThrow('Open this brand from Merchant Hub');
    expect(resolver.resolveLegacyAccess).not.toHaveBeenCalled();
  });
  it('preserves pre-migration behavior while disabled', async () => {
    const { interceptor, resolver, next } = setup(false);
    expect(await firstValueFrom(await interceptor.intercept(context(), next))).toBeUndefined();
    expect(resolver.resolveLegacyAccess).not.toHaveBeenCalled();
  });
  it.each(['invalid', [id], `${id},${id}`])('rejects malformed identifiers before database access', async selected => {
    const { interceptor, resolver, next } = setup();
    await expect(interceptor.intercept(context({ selected }), next)).rejects.toThrow('Invalid workspace');
    expect(resolver.resolveLegacyAccess).not.toHaveBeenCalled();
  });
  it.each([{ role: 'creator' }, { controller: 'SettingsController' }])('does not accept workspace context on unsupported routes', async options => {
    const { interceptor, resolver, next } = setup();
    await expect(interceptor.intercept(context({ ...options, selected: id }), next)).rejects.toThrow('unavailable');
    expect(resolver.resolveLegacyAccess).not.toHaveBeenCalled();
  });
  it('rejects selection when disabled instead of silently using another brand', async () => {
    const { interceptor, next } = setup(false);
    await expect(interceptor.intercept(context({ selected: id }), next)).rejects.toThrow('unavailable');
  });
  it('keeps creator requests out of brand scope', async () => {
    const { interceptor, resolver, next } = setup();
    expect(await firstValueFrom(await interceptor.intercept(context({ role: 'creator' }), next))).toBeUndefined();
    expect(resolver.resolveLegacyAccess).not.toHaveBeenCalled();
  });
  it('does not fall back when authorization fails', async () => {
    const { interceptor, resolver, next } = setup();
    resolver.resolveLegacyAccess.mockRejectedValueOnce(new Error('Workspace not available'));
    await expect(interceptor.intercept(context(), next)).rejects.toThrow('Workspace not available');
    expect(next.handle).not.toHaveBeenCalled();
  });
  it('blocks viewer writes and member access to payer details', async () => {
    const viewer = setup(true, 'viewer');
    await expect(viewer.interceptor.intercept(context({ method: 'POST' }), viewer.next)).rejects.toThrow('read-only');
    const member = setup(true, 'member');
    await expect(member.interceptor.intercept(context({ controller: 'BillingController' }), member.next)).rejects.toThrow('account owner');
    await expect(member.interceptor.intercept(context({ method: 'POST', handler: 'payCreator' }), member.next)).rejects.toThrow('account owner');
  });
  it.each([
    { controller: 'BillingController', handler: 'get', method: 'GET' },
    { controller: 'CampaignsController', handler: 'payCreator', method: 'POST' },
    { controller: 'CampaignsController', handler: 'payPlatformFee', method: 'POST' },
  ])('does not grant a secondary brand the account payer: %s', async options => {
    const { interceptor, next } = setup(true, 'owner', false);
    await expect(interceptor.intercept(context(options), next)).rejects.toThrow('explicitly configured');
    expect(next.handle).not.toHaveBeenCalled();
  });
  it('allows the secondary owner to read only scoped campaign financial records', async () => {
    const { interceptor, next } = setup(true, 'owner', false);
    expect(await firstValueFrom(await interceptor.intercept(context({ handler: 'listPayouts' }), next))).toMatchObject({ isDefault: false });
  });
  it('isolates concurrent asynchronous requests without changing the actor', async () => {
    const { interceptor, next } = setup();
    const [a, b] = await Promise.all(['a', 'b'].map(async actor => firstValueFrom(await interceptor.intercept(context({ actor }), next))));
    expect(a).toMatchObject({ actorUserId: 'a' });
    expect(b).toMatchObject({ actorUserId: 'b' });
    expect(workspaceContext.getStore()).toBeUndefined();
  });
});
