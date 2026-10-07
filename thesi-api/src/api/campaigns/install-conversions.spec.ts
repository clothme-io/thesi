import {
  conversionPayout,
  eventMatchesInstallApp,
  installConversionsSummary,
} from './install-conversions';

describe('install conversion events', () => {
  it('summarizes paid and tracked-only events', () => {
    expect(
      installConversionsSummary([
        { event: 'verified_account', amountCents: 100 },
        { event: 'fit_profile_completed' },
        { event: 'x_products_listed', listedProductCount: 3, amountCents: 500 },
      ]),
    ).toBe(
      '$1.00 for Verified account; Fit profile completed (tracked, no payout); $5.00 for 3 products listed',
    );
  });

  it('pays only selected events and waits for the product-count threshold', () => {
    const conversions = [
      { event: 'verified_account' as const, amountCents: 100 },
      { event: 'x_products_listed' as const, listedProductCount: 3 },
    ];
    expect(conversionPayout(conversions, 'verified_account')).toEqual({
      selected: true,
      amountCents: 100,
    });
    expect(conversionPayout(conversions, 'first_purchase')).toEqual({
      selected: false,
    });
    expect(conversionPayout(conversions, 'x_products_listed', 2)).toEqual({
      selected: false,
    });
    expect(conversionPayout(conversions, 'x_products_listed', 3)).toEqual({
      selected: true,
    });
    expect(eventMatchesInstallApp('customer', 'verified_account')).toBe(true);
    expect(eventMatchesInstallApp('customer', 'vendor_registered')).toBe(false);
  });
});
