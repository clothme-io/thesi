import {render,screen,fireEvent,cleanup,waitFor} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {CommissionSettlementPanel} from './CommissionSettlementPanel';
const request=vi.fn();
vi.mock('@/context/AuthProvider',()=>({useAuth:()=>({authenticatedRequest:request,session:{user:{role:'brand'}}})}));
vi.mock('@/context/WorkspacePermissions',()=>({useWorkspacePermissions:()=>({canManageFunds:true})}));
afterEach(()=>{cleanup();request.mockReset();});
it('requires evidence for a brand risk flag and never offers operator clearance',async()=>{
 const result={revision:2,earnedCents:500,eligibleAt:'2026-09-01',riskReviewEnabled:true,canRecover:false,holdReasons:[],totals:{reserved:500,creatorPaid:0,creatorRecovered:0,vendorReturned:0,vendorRecovered:0,refundOffset:0},operations:[],requests:[]};
 request.mockResolvedValue(result);render(<CommissionSettlementPanel orderLineId="line"/>);
 const button=await screen.findByRole('button',{name:'Flag suspected self-referral'});expect(button).toBeDisabled();
 expect(screen.queryByRole('button',{name:'Clear risk hold with evidence'})).not.toBeInTheDocument();
 fireEvent.change(screen.getByLabelText('Review / recovery reason'),{target:{value:'Buyer evidence needs review'}});
 fireEvent.click(button);
 await waitFor(()=>expect(request).toHaveBeenCalledWith('/api/commission-settlement/line/risk',{method:'POST',body:expect.objectContaining({expectedRevision:2,status:'hold',kind:'suspected_self_referral',reason:'Buyer evidence needs review'})}));
});
