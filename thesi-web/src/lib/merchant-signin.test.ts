import {beforeEach,describe,expect,it} from 'vitest';
import {readMerchantSignin,clearMerchantSignin} from './merchant-signin';
const state='s'.repeat(43),verifier='v'.repeat(43),code='c'.repeat(43);
beforeEach(()=>{sessionStorage.clear();history.replaceState(null,'','/merchant-signin');});
function save(expiresAt=Date.now()+600000){sessionStorage.setItem('thesi_merchant_signin',JSON.stringify({state,verifier,expiresAt}));}
describe('Merchant sign-in browser proof',()=>{
 it('requires this browser to have started the request',()=>{
  history.replaceState(null,'',`/merchant-signin#state=${state}&code=${code}`);
  expect(()=>readMerchantSignin()).toThrow('this browser');expect(location.hash).toBe('');
 });
 it('rejects a substituted state even with a valid-shaped code',()=>{
  save();history.replaceState(null,'',`/merchant-signin#state=${'x'.repeat(43)}&code=${code}`);
  expect(()=>readMerchantSignin()).toThrow('verification failed');expect(location.hash).toBe('');
 });
 it('supports a reload after stripping the code and clears proof after completion',()=>{
  save();history.replaceState(null,'',`/merchant-signin#state=${state}&code=${code}`);
  expect(readMerchantSignin()).toEqual({code,verifier});expect(location.hash).toBe('');
  expect(readMerchantSignin()).toEqual({code,verifier});clearMerchantSignin();expect(()=>readMerchantSignin()).toThrow('again');
 });
 it('rejects expired proof',()=>{
  save(Date.now()-1);history.replaceState(null,'',`/merchant-signin#state=${state}&code=${code}`);
  expect(()=>readMerchantSignin()).toThrow('again');
 });
});
