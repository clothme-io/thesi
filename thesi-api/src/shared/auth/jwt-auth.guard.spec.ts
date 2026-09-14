import {JwtAuthGuard} from './jwt-auth.guard';
import {JwtService} from '@nestjs/jwt';
import {MerchantAccessService} from './merchant-access.service';
import type {ExecutionContext} from '@nestjs/common';
describe('Merchant session JWT validation',()=>{
 const jwt=new JwtService({secret:'unit-test-secret'});
 function setup(claims:object,session=jest.fn(async()=>({workspaceId:'verified-workspace'}))){
  const req:any={headers:{authorization:`Bearer ${jwt.sign(claims)}`}};
  const ctx={switchToHttp:()=>({getRequest:()=>req})} as ExecutionContext;
  return {req,ctx,session,guard:new JwtAuthGuard(jwt,{session} as unknown as MerchantAccessService)};
 }
 it('preserves standalone authentication without contacting Merchant',async()=>{
  const {req,ctx,session,guard}=setup({sub:'owner',role:'brand'});
  expect(await guard.canActivate(ctx)).toBe(true);expect(req.user.sub).toBe('owner');expect(session).not.toHaveBeenCalled();
 });
 it('derives workspace from current server authority and keeps the signed actor',async()=>{
  const {req,ctx,session,guard}=setup({sub:'staff',role:'brand',merchantSessionId:'session',merchantWorkspaceId:'old-workspace'});
  await guard.canActivate(ctx);expect(req.user.sub).toBe('staff');expect(req.user.merchantWorkspaceId).toBe('verified-workspace');expect(session).toHaveBeenCalledWith('staff','session');
 });
 it('fails closed after revocation even when the JWT has not expired',async()=>{
  const {ctx,guard}=setup({sub:'staff',merchantSessionId:'session'},jest.fn().mockRejectedValue(new Error('revoked')));
  await expect(guard.canActivate(ctx)).rejects.toThrow('revoked');
 });
});
