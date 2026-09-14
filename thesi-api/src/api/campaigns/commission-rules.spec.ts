import {
  DEFAULT_COMMISSION_RULES as defaults,
  assertCommissionRules,
  commissionEligibleAt,
} from './commission-rules';
describe('accepted commission payout rules', () => {
  it('defaults to a 30-day review with no threshold or creator fee', () => {
    expect(defaults).toMatchObject({
      reviewDays: 30,
      minimumPayoutCents: 0,
      creatorFeeCents: 0,
      payoutFrequency: 'on_approval',
    });
    expect(commissionEligibleAt('2026-01-01T12:00:00Z', defaults)).toBe(
      '2026-01-31T12:00:00.000Z',
    );
  });
  it('uses the next UTC Monday without shortening review', () => {
    expect(
      commissionEligibleAt('2026-09-14T00:00:00Z', {
        ...defaults,
        reviewDays: 0,
        payoutFrequency: 'weekly',
      }),
    ).toBe('2026-09-14T00:00:00.000Z');
    expect(
      commissionEligibleAt('2026-09-14T00:00:00.001Z', {
        ...defaults,
        reviewDays: 0,
        payoutFrequency: 'weekly',
      }),
    ).toBe('2026-09-21T00:00:00.000Z');
  });
  it('handles monthly boundaries and year rollover', () => {
    expect(
      commissionEligibleAt('2026-12-31T23:59:59Z', {
        ...defaults,
        reviewDays: 0,
        payoutFrequency: 'monthly',
      }),
    ).toBe('2027-01-01T00:00:00.000Z');
  });
  it.each([
    { reviewDays: -1 },
    { reviewDays: 366 },
    { minimumPayoutCents: 0.5 },
    { creatorFeeCents: 1 },
    { creditPolicy: 'allow' },
    { payoutFrequency: 'daily' },
  ])('rejects invalid or unsupported terms: %j', (change) => {
    expect(() => assertCommissionRules({ ...defaults, ...change })).toThrow();
  });
});
