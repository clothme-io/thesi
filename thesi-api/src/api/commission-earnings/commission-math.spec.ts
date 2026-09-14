import { commissionResult } from './commission-math';
const facts = {
  currency: 'USD',
  netSaleCents: 10001,
  platformFeeCents: 201,
  fullyRefunded: false,
  holdReasons: [],
};
describe('commission amounts', () => {
  it('deducts the verified refunded platform fee before calculating commission', () => {
    expect(
      commissionResult(
        { ...facts, refundedNetCents: 1000, refundedPlatformFeeCents: 20 },
        'percentage_of_platform_commission',
        50,
      ),
    ).toMatchObject({ accruedCents: 90, state: 'under_review' });
    expect(() =>
      commissionResult(
        { ...facts, refundedPlatformFeeCents: 202 },
        'percentage_of_platform_commission',
        50,
      ),
    ).toThrow('Invalid refunded platform fee');
  });
  it('recalculates the remaining merchandise once after an allocated refund', () => {
    expect(
      commissionResult(
        { ...facts, refundedNetCents: 1000 },
        'percentage_of_sale',
        10,
      ),
    ).toMatchObject({ accruedCents: 900, state: 'under_review' });
    expect(
      commissionResult(
        { ...facts, refundedNetCents: 10001 },
        'percentage_of_sale',
        10,
      ),
    ).toMatchObject({ accruedCents: 0, state: 'reversed' });
  });
  it('holds platform-fee commission until fee reversals are known', () =>
    expect(
      commissionResult(
        { ...facts, refundedNetCents: 1000 },
        'percentage_of_platform_commission',
        50,
      ).state,
    ).toBe('held'));
  it('rejects refunds larger than the original merchandise amount', () =>
    expect(() =>
      commissionResult(
        { ...facts, refundedNetCents: 10002 },
        'percentage_of_sale',
        10,
      ),
    ).toThrow());
  it('uses net sale cents and floors once', () =>
    expect(commissionResult(facts, 'percentage_of_sale', 12.34)).toEqual({
      accruedCents: 1234,
      state: 'under_review',
      reasons: [],
    }));
  it('uses the actual allocated platform fee', () =>
    expect(
      commissionResult(facts, 'percentage_of_platform_commission', 50)
        .accruedCents,
    ).toBe(100));
  it('does not invent a missing fee', () =>
    expect(
      commissionResult(
        { ...facts, platformFeeCents: null },
        'percentage_of_platform_commission',
        50,
      ),
    ).toMatchObject({
      accruedCents: 0,
      state: 'held',
      reasons: ['platform_fee_unavailable'],
    }));
  it('holds partial refunds and reverses full refunds', () => {
    expect(
      commissionResult(
        { ...facts, holdReasons: ['partial_refund_requires_line_allocation'] },
        'percentage_of_sale',
        10,
      ).state,
    ).toBe('held');
    expect(
      commissionResult(
        { ...facts, fullyRefunded: true },
        'percentage_of_sale',
        10,
      ),
    ).toMatchObject({ accruedCents: 0, state: 'reversed' });
  });
  it('holds currencies without automatic conversion', () =>
    expect(
      commissionResult({ ...facts, currency: 'CAD' }, 'percentage_of_sale', 10)
        .state,
    ).toBe('held'));
  it('avoids floating point multiplication overflow', () =>
    expect(
      commissionResult(
        { ...facts, netSaleCents: Number.MAX_SAFE_INTEGER },
        'percentage_of_sale',
        99.99,
      ).accruedCents,
    ).toBe(Number((BigInt(Number.MAX_SAFE_INTEGER) * 9999n) / 10000n)));
  it.each([0, 101, NaN, 1.234])('rejects invalid rate %s', (rate) =>
    expect(() => commissionResult(facts, 'percentage_of_sale', rate)).toThrow(),
  );
});
