import {
  assertCommissionPayment,
  commissionInviteTerms,
  isAppInstallPayment,
  isProductCommissionPayment,
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
  it('supports commission only without creating a base fee or milestone', () => {
    const payment = commissionFixture();
    delete payment.hybrid!.base;
    expect(() => assertCommissionPayment(payment)).not.toThrow();
    expect(previewPlatformFee(payment)).toMatchObject({payoutCents:0,feeCents:0});
    expect(commissionInviteTerms(payment)).toContain('Commission only: 12.25%');
    expect(commissionInviteTerms(payment)).not.toContain('Base payment earned when');
  });
  it('does not count a disabled historical base in estimates', () => {
    const payment = commissionFixture(); payment.hybrid!.base!.enabled=false;
    expect(() => assertCommissionPayment(payment)).not.toThrow();
    expect(previewPlatformFee(payment).feeCents).toBe(0);
  });
  it('allows an enabled zero-dollar base payment', () => {
    const payment = commissionFixture();
    payment.hybrid!.base!.amountCents = 0;
    expect(() => assertCommissionPayment(payment)).not.toThrow();
    expect(previewPlatformFee(payment)).toMatchObject({ payoutCents: 0, feeCents: 0 });
    expect(commissionInviteTerms(payment)).toContain('$0.00 base per creator');
  });
  it('includes the product context and honest demo destination in invitations', () => {
    const payment = commissionFixture();
    payment.promotedProduct = { productId: 'p', brandId: 'b', vendorId: 'v', linkId: 'l', workspaceId: 'w',
      title: 'Linen shirt', brandName: 'Brand', description: '', imageUrl: null, verifiedAt: 'today', previewUrl: 'https://thesi.test/product-preview/b/p' };
    const terms = commissionInviteTerms(payment);
    expect(terms).toContain('Product to promote: Linen shirt — Brand');
    expect(terms).toContain('https://thesi.test/product-preview/b/p');
    expect(terms).toContain('does not track sales or earn commission');
  });
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

  it.each([undefined, -1, 1.5, 2_147_483_648])(
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
    fixed.hybrid!.affiliate!.commissionPercent = undefined;
    fixed.hybrid!.affiliate!.fixedAmountCents = 250;
    expect(() => assertCommissionPayment(fixed)).not.toThrow();
    expect(commissionInviteTerms(fixed)).toContain('$2.50 per attributed product sale');
    const install = commissionFixture();
    install.hybrid!.affiliate!.commissionType = 'fixed_amount_per_install';
    install.hybrid!.affiliate!.commissionPercent = undefined;
    install.hybrid!.affiliate!.fixedAmountCents = 200;
    install.hybrid!.affiliate!.fundingFlowVersion = 1;
    install.hybrid!.affiliate!.payoutHandler = 'clothme';
    install.hybrid!.affiliate!.fundingSource = 'brand';
    expect(() => assertCommissionPayment(install)).not.toThrow();
    expect(commissionInviteTerms(install)).toContain('$2.00 per qualified app install');
    expect(commissionInviteTerms(install)).toContain('does not collect a prepaid install pool');
    expect(commissionInviteTerms(install)).not.toContain('funded campaign balance');
  });

  it('treats product_commission and app_install as first-class models', () => {
    const product = commissionFixture();
    product.model = 'product_commission';
    expect(isProductCommissionPayment(product)).toBe(true);
    expect(() => assertCommissionPayment(product)).not.toThrow();
    const install = commissionFixture();
    install.model = 'app_install';
    install.hybrid!.affiliate!.commissionType = 'fixed_amount_per_install';
    install.hybrid!.affiliate!.commissionPercent = undefined;
    install.hybrid!.affiliate!.fixedAmountCents = 200;
    expect(isAppInstallPayment(install)).toBe(true);
    expect(() => assertCommissionPayment(install)).not.toThrow();
    expect(isAppInstallPayment(commissionFixture())).toBe(false);
    expect(
      isProductCommissionPayment({
        model: 'commission',
        hybrid: { affiliate: { commissionType: 'fixed_amount_per_install' } },
      }),
    ).toBe(false);
    const mixed = commissionFixture();
    mixed.model = 'product_commission';
    mixed.hybrid!.affiliate!.commissionType = 'fixed_amount_per_install';
    mixed.hybrid!.affiliate!.commissionPercent = undefined;
    mixed.hybrid!.affiliate!.fixedAmountCents = 200;
    expect(() => assertCommissionPayment(mixed)).toThrow(/cannot use app install/i);
    const installPercent = commissionFixture();
    installPercent.model = 'app_install';
    expect(() => assertCommissionPayment(installPercent)).toThrow(
      /fixed amount per qualified install/i,
    );
  });

  it('accepts mixed paid and tracked install conversion events', () => {
    const payment = commissionFixture();
    payment.model = 'app_install';
    payment.hybrid!.affiliate!.commissionType = 'fixed_amount_per_install';
    payment.hybrid!.affiliate!.commissionPercent = undefined;
    payment.hybrid!.affiliate!.fixedAmountCents = undefined;
    payment.hybrid!.affiliate!.installApp = 'customer';
    payment.hybrid!.affiliate!.fundingFlowVersion = 1;
    payment.hybrid!.affiliate!.payoutHandler = 'clothme';
    payment.hybrid!.affiliate!.fundingSource = 'brand';
    payment.hybrid!.affiliate!.conversions = [
      { event: 'verified_account', amountCents: 100 },
      { event: 'fit_profile_completed' },
      { event: 'first_purchase', amountCents: 500 },
    ];
    expect(() => assertCommissionPayment(payment)).not.toThrow();
    expect(commissionInviteTerms(payment)).toContain('$1.00 for Verified account');
    expect(commissionInviteTerms(payment)).toContain(
      'Fit profile completed (tracked, no payout)',
    );
    expect(commissionInviteTerms(payment)).toContain('$5.00 for First purchase');
    expect(commissionInviteTerms(payment)).toContain(
      'Opening the install link only attributes the new user',
    );
  });

  it('rejects install campaigns with no conversion events or payout', () => {
    const payment = commissionFixture();
    payment.model = 'app_install';
    payment.hybrid!.affiliate!.commissionType = 'fixed_amount_per_install';
    payment.hybrid!.affiliate!.commissionPercent = undefined;
    payment.hybrid!.affiliate!.fixedAmountCents = undefined;
    expect(() => assertCommissionPayment(payment)).toThrow(/conversion event/i);
  });

  it('rejects vendor events on a customer install campaign', () => {
    const payment = commissionFixture();
    payment.model = 'app_install';
    payment.hybrid!.affiliate!.commissionType = 'fixed_amount_per_install';
    payment.hybrid!.affiliate!.commissionPercent = undefined;
    payment.hybrid!.affiliate!.installApp = 'customer';
    payment.hybrid!.affiliate!.conversions = [{ event: 'vendor_registered' }];
    expect(() => assertCommissionPayment(payment)).toThrow(/Customer or Vendor/i);
  });
});
