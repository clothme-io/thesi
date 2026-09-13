import {
  assertCommissionPayment,
  commissionInviteTerms,
} from './commission-payment';
import type { CampaignPaymentDto } from './dto/campaign.dto';
import { previewPlatformFee } from 'src/shared/platform-fee/platform-fee.util';

export function commissionFixture(): CampaignPaymentDto {
  return {
    model: 'commission',
    hybrid: {
      base: {
        enabled: true,
        amountCents: 20050,
        currency: 'USD',
        trigger: 'content_accepted',
      },
      affiliate: {
        enabled: true,
        commissionType: 'percentage_of_sale',
        commissionPercent: 12.25,
        currency: 'USD',
        attributionWindowDays: 30,
        terms:
          'Eligible net sales excluding refunds. Settled monthly after 30 days.',
      },
    },
  };
}

describe('commission terms', () => {
  it.each(['percentage_of_sale', 'percentage_of_platform_commission'] as const)(
    'accepts %s and limits fee estimates to the base',
    (commissionType) => {
      const payment = commissionFixture();
      payment.hybrid!.affiliate!.commissionType = commissionType;
      expect(() => assertCommissionPayment(payment)).not.toThrow();
      expect(previewPlatformFee(payment)).toMatchObject({
        payoutCents: 20050,
        feeCents: 401,
      });
      expect(commissionInviteTerms(payment)).toContain(
        '$200.50 base per creator + 12.25%',
      );
      expect(commissionInviteTerms(payment)).toContain(
        payment.hybrid!.affiliate!.terms,
      );
      expect(commissionInviteTerms(payment)).toContain(
        commissionType === 'percentage_of_sale'
          ? 'eligible sales'
          : 'platform commission',
      );
    },
  );

  it.each([undefined, 0, -1, 100.01, 10.123, NaN, Infinity])(
    'rejects invalid rate %s',
    (rate) => {
      const payment = commissionFixture();
      payment.hybrid!.affiliate!.commissionPercent = rate;
      expect(() => assertCommissionPayment(payment)).toThrow(/rate/i);
    },
  );

  it.each([undefined, 0, -1, 1.5, 2_147_483_648])(
    'rejects invalid base %s',
    (amount) => {
      const payment = commissionFixture();
      payment.hybrid!.base!.amountCents = amount;
      expect(() => assertCommissionPayment(payment)).toThrow(/base payment/i);
    },
  );

  it('rejects incomplete terms and ambiguous legacy fields', () => {
    expect(() => assertCommissionPayment({ model: 'commission' })).toThrow();
    const payment = commissionFixture();
    payment.hybrid!.affiliate!.terms = ' ';
    expect(() => assertCommissionPayment(payment)).toThrow(/settlement/i);
    expect(() =>
      assertCommissionPayment({ ...commissionFixture(), flatRateCents: 999 }),
    ).toThrow(/only/i);
    const fixed = commissionFixture();
    fixed.hybrid!.affiliate!.commissionType = 'fixed_amount_per_sale';
    expect(() => assertCommissionPayment(fixed)).toThrow(/commission base/i);
  });
});
