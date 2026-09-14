import { FundingGateway } from './funding.gateway';
const stripe = {
  paymentIntents: { create: jest.fn(), retrieve: jest.fn() },
  charges: { retrieve: jest.fn() },
  transfers: { create: jest.fn() },
  refunds: { create: jest.fn(), retrieve: jest.fn() },
};
jest.mock('stripe', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => stripe),
}));
const operation = {
  id: 'op1',
  campaign_id: 'campaign',
  kind: 'deposit',
  amount_cents: 10000,
  args: { customerId: 'cus_1', paymentMethodId: 'pm_1' },
};
const gateway = () =>
  new FundingGateway({
    get: () => true,
    getOrThrow: () => 'sk_test_fixture',
  } as any);
beforeEach(() => jest.clearAllMocks());
it('verifies captured deposit and uses the persisted operation id for provider idempotency', async () => {
  stripe.paymentIntents.create.mockResolvedValue({
    id: 'pi_1',
    amount: 10000,
    currency: 'usd',
    customer: 'cus_1',
    status: 'succeeded',
    amount_received: 10000,
    latest_charge: 'ch_1',
  });
  expect(await gateway().execute(operation)).toEqual({
    id: 'pi_1',
    chargeId: 'ch_1',
  });
  expect(stripe.paymentIntents.create.mock.calls[0][1]).toEqual({
    idempotencyKey: 'thesi-fund:op1',
  });
});
it('does not count a pending or mismatched deposit as captured', async () => {
  stripe.paymentIntents.retrieve.mockResolvedValue({
    id: 'pi_1',
    amount: 10000,
    currency: 'usd',
    customer: 'cus_1',
    status: 'processing',
  });
  expect(
    await gateway().execute({ ...operation, provider_id: 'pi_1' }),
  ).toEqual({ id: 'pi_1', pending: true });
  stripe.paymentIntents.retrieve.mockResolvedValue({
    id: 'pi_1',
    amount: 10000,
    currency: 'usd',
    customer: 'cus_other',
    status: 'succeeded',
  });
  await expect(
    gateway().execute({ ...operation, provider_id: 'pi_1' }),
  ).rejects.toThrow(/mismatch/);
  expect(stripe.paymentIntents.create).not.toHaveBeenCalled();
});
it('holds a base release when the captured deposit has an unreconciled refund or dispute', async () => {
  const release = {
    ...operation,
    kind: 'release',
    obligation_id: 'ob1',
    args: { chargeId: 'ch_1', destination: 'acct_1', expectedRefundCents: 0 },
  };
  stripe.charges.retrieve.mockResolvedValue({
    paid: true,
    captured: true,
    currency: 'usd',
    amount_refunded: 1,
  });
  await expect(gateway().execute(release)).rejects.toThrow(/reconciliation/);
  stripe.charges.retrieve.mockResolvedValue({
    paid: true,
    captured: true,
    currency: 'usd',
    disputed: true,
  });
  await expect(gateway().execute(release)).rejects.toThrow(/review/);
  expect(stripe.transfers.create).not.toHaveBeenCalled();
});
it('pays from the captured campaign charge and verifies the creator destination', async () => {
  stripe.charges.retrieve.mockResolvedValue({
    paid: true,
    captured: true,
    currency: 'usd',
    amount_refunded: 0,
  });
  stripe.transfers.create.mockResolvedValue({
    id: 'tr_1',
    amount: 10000,
    currency: 'usd',
    destination: 'acct_1',
  });
  const result = await gateway().execute({
    ...operation,
    kind: 'release',
    obligation_id: 'ob1',
    args: { chargeId: 'ch_1', destination: 'acct_1', expectedRefundCents: 0 },
  });
  expect(result.id).toBe('tr_1');
  expect(stripe.transfers.create.mock.calls[0][0].source_transaction).toBe(
    'ch_1',
  );
});
it('polls a pending refund rather than submitting a new one', async () => {
  stripe.charges.retrieve.mockResolvedValue({
    paid: true,
    captured: true,
    currency: 'usd',
  });
  stripe.refunds.retrieve.mockResolvedValue({
    id: 're_1',
    amount: 10000,
    currency: 'usd',
    payment_intent: 'pi_1',
    status: 'pending',
  });
  expect(
    await gateway().execute({
      ...operation,
      kind: 'refund_unused',
      provider_id: 're_1',
      args: { chargeId: 'ch_1', paymentIntentId: 'pi_1' },
    }),
  ).toEqual({ id: 're_1', pending: true });
  expect(stripe.refunds.create).not.toHaveBeenCalled();
});

it('requires refund recovery evidence for this exact operation, not just the same campaign and amount', async () => {
  const op = {
    ...operation,
    kind: 'refund_cancelled',
    args: { paymentIntentId: 'pi_1' },
  };
  const refund = {
    id: 're_1',
    status: 'succeeded',
    amount: 10000,
    currency: 'usd',
    payment_intent: 'pi_1',
    metadata: {
      campaignId: 'campaign',
      fundingOperationId: 'another_operation',
    },
  };
  stripe.refunds.retrieve.mockResolvedValue(refund);
  await expect(gateway().verifyRecovery(op, 're_1')).rejects.toThrow(
    'Refund does not match',
  );
  stripe.refunds.retrieve.mockResolvedValue({
    ...refund,
    metadata: { ...refund.metadata, fundingOperationId: 'op1' },
  });
  await expect(gateway().verifyRecovery(op, 're_1')).resolves.toEqual({
    id: 're_1',
  });
});
it('only exposes authentication for a verified existing deposit and current saved card', async () => {
  stripe.paymentIntents.retrieve.mockResolvedValue({
    amount: 10000,
    currency: 'usd',
    customer: 'cus_1',
    status: 'requires_action',
    client_secret: 'demo_secret',
  });
  await expect(
    gateway().depositAction({ ...operation, provider_id: 'pi_1' }, 'pm_new'),
  ).resolves.toEqual({
    status: 'requires_action',
    clientSecret: 'demo_secret',
    paymentMethodId: 'pm_new',
  });
  await expect(
    gateway().depositAction(
      { ...operation, provider_id: 'pi_1', amount_cents: 20000 },
      'pm_new',
    ),
  ).rejects.toThrow('verification mismatch');
});
it('does not authorize a new refund key for a pending provider refund', async () => {
  stripe.refunds.retrieve.mockResolvedValue({
    status: 'pending',
    payment_intent: 'pi_1',
    amount: 10000,
  });
  await expect(
    gateway().verifyFailedRefund({
      ...operation,
      kind: 'refund_unused',
      provider_id: 're_1',
      args: { paymentIntentId: 'pi_1' },
    }),
  ).rejects.toThrow('not terminally failed');
});
