import {
  applyCombinedBalancePolicy,
  CommissionSettlementService,
} from './commission-settlement.service';
import { workspaceContext } from '../brand-workspaces/workspace-context';
const sale = {
  workspace_id: 'brand-workspace',
  owner_user_id: 'owner',
  workspace_owner: 'owner',
  creator_user_id: 'creator',
  receipt_id: 'receipt',
};
it('rejects creators and other workspaces before any settlement request', async () => {
  const service = new CommissionSettlementService(
    { execute: async () => ({ rows: [sale] }) } as any,
    { get: (key: string) => key === 'COMMISSION_SETTLEMENT_ENABLED' } as any,
    {} as any,
  );
  const remote = jest.fn();
  (service as any).commerce = remote;
  await expect(
    service.decide({ sub: 'creator', role: 'creator' }, 'line', {
      requestId: 'request',
      action: 'qualify',
      reason: 'reason',
      expectedRevision: 1,
    }),
  ).rejects.toThrow('Select the brand');
  await workspaceContext.run(
    { actorUserId: 'owner', role: 'owner', workspaceId: 'other-workspace' },
    async () => {
      await expect(
        service.preview({ sub: 'owner', role: 'brand' }, 'line'),
      ).rejects.toThrow('Select the brand');
    },
  );
  expect(remote).not.toHaveBeenCalled();
});
it('provider recovery requires an explicitly configured operator', async () => {
  const service = new CommissionSettlementService(
    {} as any,
    { get: () => undefined } as any,
    {} as any,
  );
  await expect(
    service.recover(
      { sub: 'owner', role: 'brand' },
      'line',
      'op',
      'tr_1',
      'reason',
    ),
  ).rejects.toThrow('operator access');
});
it('allows a brand to flag but only an operator to clear risk',async()=>{
 const service=new CommissionSettlementService({execute:async()=>({rows:[sale]})} as any,{get:(k:string)=>k==='COMMISSION_SETTLEMENT_ENABLED'?true:k==='SETTLEMENT_OPERATOR_USER_IDS'?'ops':undefined} as any,{} as any);
 const remote=jest.fn().mockResolvedValue({});(service as any).commerce=remote;(service as any).preview=async()=>({});
 const input={requestId:'risk',expectedRevision:1,status:'clear' as const,kind:'fraud' as const,reason:'Evidence checked'};
 await workspaceContext.run({actorUserId:'owner',role:'owner',workspaceId:'brand-workspace'},async()=>{
  await expect(service.reviewRisk({sub:'owner',role:'brand'},'line',input)).rejects.toThrow('Only a ClothME');
  expect(remote).not.toHaveBeenCalled();await service.reviewRisk({sub:'owner',role:'brand'},'line',{...input,status:'hold'});
  expect(remote).toHaveBeenLastCalledWith('risk',expect.objectContaining({actorId:'owner',receiptId:'receipt',status:'hold'}));
 });
 await service.reviewRisk({sub:'ops',role:'brand'},'line',input);
 expect(remote).toHaveBeenLastCalledWith('risk',expect.objectContaining({actorId:'ops',status:'clear'}));
});
it('rejects batch previews unless the actor is the selected workspace owner', async () => {
  const service = new CommissionSettlementService(
    {
      execute: async () => ({ rows: [{ owner_user_id: 'owner' }] }),
    } as any,
    { get: (key: string) => key === 'COMMISSION_SETTLEMENT_ENABLED' } as any,
    {} as any,
  );
  (service as any).batchReady = async () => undefined;
  (service as any).batchCandidates = jest.fn().mockResolvedValue([]);

  await expect(
    service.batchPreview({ sub: 'creator', role: 'creator' }),
  ).rejects.toThrow('workspace owner');

  await workspaceContext.run(
    { actorUserId: 'member', role: 'member', workspaceId: 'brand-workspace' },
    async () => {
      await expect(
        service.batchPreview({ sub: 'member', role: 'brand' }),
      ).rejects.toThrow('workspace owner');
    },
  );

  await workspaceContext.run(
    { actorUserId: 'owner', role: 'owner', workspaceId: 'brand-workspace' },
    async () => {
      await expect(
        service.batchPreview({ sub: 'owner', role: 'brand' }),
      ).resolves.toMatchObject({ readyCount: 0, lines: [] });
    },
  );
});

it('requires a review reason before a settlement batch can run', async () => {
  const service = new CommissionSettlementService(
    {} as any,
    { get: (key: string) => key === 'COMMISSION_SETTLEMENT_ENABLED' } as any,
    {} as any,
  );
  (service as any).batchReady = async () => undefined;
  await expect(
    service.runBatch({ sub: 'owner', role: 'brand' }, {
      batchId: '00000000-0000-4000-8000-000000000000',
      reason: ' ',
    }),
  ).rejects.toThrow('batch settlement review');
});

describe('combined balance settlement policy', () => {
  const line = (id: string, remainingCents: string, minimumPayoutCents = 1000) => ({
    orderLineId: id,
    creatorId: 'creator',
    currency: 'USD',
    earnedCents: remainingCents,
    netPaidCents: '0',
    remainingCents,
    minimumPayoutCents,
    eligibleAt: '2026-01-01T00:00:00.000Z',
    ready: true,
    reasons: [],
  });
  it('blocks below-minimum individual lines when combined balance is off', () => {
    const [a] = applyCombinedBalancePolicy(
      [line('00000000-0000-4000-8000-000000000001', '500')],
      false,
    );
    expect(a.ready).toBe(false);
    expect(a.reasons).toContain('individual_payout_below_minimum');
  });
  it('allows below-minimum lines when the creator group meets the threshold', () => {
    const rows = applyCombinedBalancePolicy(
      [
        line('00000000-0000-4000-8000-000000000001', '500'),
        line('00000000-0000-4000-8000-000000000002', '500'),
      ],
      true,
    );
    expect(rows.every((row) => row.ready)).toBe(true);
    expect(rows[0].combinedPayout).toMatchObject({
      totalCents: 1000,
      minimumCents: 1000,
    });
    expect(rows[0].combinedPayout?.lineIds).toHaveLength(2);
  });
});
