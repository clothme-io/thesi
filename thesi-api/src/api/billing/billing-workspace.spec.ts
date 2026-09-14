import { BillingService } from './billing.service';
import { workspaceContext } from '../brand-workspaces/workspace-context';

describe('workspace payer boundary', () => {
  it('rejects a secondary brand before any payer lookup or provider call', async () => {
    // No dependencies: accessing one would fail this test before the expected guard.
    const service = Object.create(BillingService.prototype) as BillingService;
    await workspaceContext.run({ workspaceId: 'secondary', actorUserId: 'owner', role: 'owner', isDefault: false }, async () => {
      await expect(service.resolveChargeContext('owner')).rejects.toThrow('explicitly configured');
    });
  });
});

it('allows the explicit campaign funding path only for the selected workspace owner', async () => {
  const service = Object.create(BillingService.prototype) as BillingService;
  const resolve = jest.fn().mockResolvedValue({ customerId: 'cus_fixture' });
  (service as any).resolveOwnerChargeContext = resolve;
  await workspaceContext.run({workspaceId:'secondary',actorUserId:'owner',role:'owner',isDefault:false},async()=>{
    await expect(service.resolveCampaignFundingChargeContext('owner','another')).rejects.toThrow();
    await expect(service.resolveCampaignFundingChargeContext('another','secondary')).rejects.toThrow();
    expect(resolve).not.toHaveBeenCalled();
    await expect(service.resolveCampaignFundingChargeContext('owner','secondary')).resolves.toEqual({customerId:'cus_fixture'});
  });
  await workspaceContext.run({workspaceId:'secondary',actorUserId:'staff',role:'viewer'},async()=>{
    await expect(service.resolveCampaignFundingChargeContext('staff','secondary')).rejects.toThrow();
  });
});
