import { settlementPlan, type SettlementTotals } from './settlement-math';
const initial: SettlementTotals = {
  reserved: 500,
  creatorPaid: 0,
  creatorRecovered: 0,
  vendorReturned: 0,
  vendorRecovered: 0,
  refundOffset: 0,
};
it('requires qualification before a commission transfer', () => {
  expect(settlementPlan(initial, 500, 0, false)).toBeNull();
  expect(settlementPlan(initial, 500, 0, true)).toEqual({
    kind: 'creator_transfer',
    amount: 500,
  });
});
it('recovers paid commission before applying its refund portion', () => {
  expect(
    settlementPlan({ ...initial, creatorPaid: 500 }, 400, 100, false),
  ).toEqual({ kind: 'creator_reversal', amount: 100 });
  expect(
    settlementPlan(
      { ...initial, creatorPaid: 500, creatorRecovered: 100 },
      400,
      100,
      false,
    ),
  ).toEqual({ kind: 'refund_offset', amount: 100 });
});
it('returns disqualified reserves to the brand without paying the creator', () => {
  expect(settlementPlan(initial, 0, 0, false)).toEqual({
    kind: 'vendor_return',
    amount: 500,
  });
});
it('recovers an already-returned brand reserve when a later refund needs it', () => {
  expect(
    settlementPlan({ ...initial, vendorReturned: 500 }, 0, 100, false),
  ).toEqual({ kind: 'vendor_reversal', amount: 100 });
  expect(
    settlementPlan(
      { ...initial, vendorReturned: 500, vendorRecovered: 100 },
      0,
      100,
      false,
    ),
  ).toEqual({ kind: 'refund_offset', amount: 100 });
});
it('cannot return money already applied to customer refunds', () => {
  expect(
    settlementPlan(
      { ...initial, creatorPaid: 400, refundOffset: 100 },
      400,
      100,
      true,
    ),
  ).toBeNull();
});
it.each([-1, NaN, Infinity, 0.1])('rejects unsafe money %s', (reserved) => {
  expect(() => settlementPlan({ ...initial, reserved }, 0, 0, false)).toThrow();
});
it('rejects spending beyond the reserve and decreasing acknowledged refunds', () => {
  expect(() => settlementPlan(initial, 501, 0, true)).toThrow();
  expect(() =>
    settlementPlan({ ...initial, refundOffset: 100 }, 400, 0, false),
  ).toThrow();
});
