import {
  calculatePlatformFeeCents,
  campaignPayoutCents,
  PLATFORM_FEE_CAP_CENTS,
  PLATFORM_FEE_RATE,
  previewPlatformFee,
} from './platform-fee.util';

describe('calculatePlatformFeeCents', () => {
  it('charges 2% when below $250 cap', () => {
    expect(calculatePlatformFeeCents(1_000_000)).toBe(20_000); // 2% of $10,000
    expect(calculatePlatformFeeCents(100_000)).toBe(2_000); // 2% of $1,000
  });

  it('caps at $250 when 2% exceeds cap', () => {
    expect(calculatePlatformFeeCents(20_000_000)).toBe(PLATFORM_FEE_CAP_CENTS); // 2% of $200k = $4k → cap
    expect(calculatePlatformFeeCents(1_250_001)).toBe(PLATFORM_FEE_CAP_CENTS); // just over break-even
  });

  it('charges exactly $250 at break-even payout', () => {
    const breakEven = PLATFORM_FEE_CAP_CENTS / PLATFORM_FEE_RATE;
    expect(calculatePlatformFeeCents(breakEven)).toBe(PLATFORM_FEE_CAP_CENTS);
  });

  it('returns 0 for zero or negative payout', () => {
    expect(calculatePlatformFeeCents(0)).toBe(0);
    expect(calculatePlatformFeeCents(-100)).toBe(0);
  });
});

describe('campaignPayoutCents', () => {
  it('uses flat rate for flat/hybrid/royalty', () => {
    expect(
      campaignPayoutCents({ model: 'flat_rate', flatRateCents: 50_000 }),
    ).toBe(50_000);
  });

  it('sums milestones', () => {
    expect(
      campaignPayoutCents({
        model: 'milestone',
        milestones: [{ amountCents: 10_000 }, { amountCents: 15_000 }],
      }),
    ).toBe(25_000);
  });
});

describe('previewPlatformFee', () => {
  it('marks capped fees', () => {
    const preview = previewPlatformFee({
      model: 'flat_rate',
      flatRateCents: 20_000_000,
    });
    expect(preview.feeCents).toBe(PLATFORM_FEE_CAP_CENTS);
    expect(preview.capped).toBe(true);
  });
});
