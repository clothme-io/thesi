import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {cleanup,renderHook,waitFor} from '@testing-library/react';
import {WorkspacePermissionsProvider,useWorkspacePermissions} from './WorkspacePermissions';
const auth=vi.hoisted(()=>({session:{user:{id:'staff',role:'brand'},refreshToken:'mh.fixture'},authenticatedRequest:vi.fn()}));
vi.mock('@/context/AuthProvider',()=>({useAuth:()=>auth}));
const wrapper=({children}:{children:React.ReactNode})=><WorkspacePermissionsProvider>{children}</WorkspacePermissionsProvider>;
beforeEach(()=>{localStorage.clear();sessionStorage.clear();auth.authenticatedRequest.mockReset();});
afterEach(cleanup);
describe('Merchant workspace controls',()=>{
 it.each(['viewer','member','owner'])('uses current workspace permissions for %s',async role=>{
  auth.authenticatedRequest.mockResolvedValue([{id:'10000000-0000-4000-8000-000000000001',role,isDefault:false}]);
  const {result}=renderHook(useWorkspacePermissions,{wrapper});
  await waitFor(()=>expect(result.current.ready).toBe(true));
  expect(result.current.canEdit).toBe(role!=='viewer');expect(result.current.canManageFunds).toBe(role==='owner');
  expect(sessionStorage.getItem('thesi_workspace:staff')).toBe('10000000-0000-4000-8000-000000000001');
 });
 it('keeps actions unavailable when authority cannot be checked',async()=>{
  auth.authenticatedRequest.mockRejectedValue(new Error('Merchant unavailable'));
  const {result}=renderHook(useWorkspacePermissions,{wrapper});
  await waitFor(()=>expect(result.current.ready).toBe(true));
  expect(result.current.canEdit).toBe(false);expect(result.current.canManageFunds).toBe(false);
 });
});
