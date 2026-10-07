import { assertCommissionRules, commissionRulesText } from './commission-rules';
import {
  eventMatchesInstallApp,
  installConversionsSummary,
  isInstallApp,
  isInstallConversionEvent,
  type InstallConversion,
} from './install-conversions';
import { promotedProducts } from './promoted-products';
import { BadRequestException } from '@nestjs/common';
import type { CampaignPaymentDto } from './dto/campaign.dto';

type PaymentKind = {
  model?: string;
  hybrid?: { affiliate?: { commissionType?: string } };
};

export function isAttributedCommissionPayment(payment?: PaymentKind | null) {
  return (
    payment?.model === 'commission' ||
    payment?.model === 'product_commission' ||
    payment?.model === 'app_install'
  );
}

export function isAppInstallPayment(payment?: PaymentKind | null) {
  if (payment?.model === 'app_install') return true;
  return (
    payment?.model === 'commission' &&
    payment.hybrid?.affiliate?.commissionType === 'fixed_amount_per_install'
  );
}

export function isProductCommissionPayment(payment?: PaymentKind | null) {
  if (payment?.model === 'product_commission') return true;
  return (
    payment?.model === 'commission' &&
    payment.hybrid?.affiliate?.commissionType !== 'fixed_amount_per_install'
  );
}

export function commissionInviteTerms(payment: CampaignPaymentDto): string {
  const base = payment.hybrid?.base;
  const commission = payment.hybrid?.affiliate;
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format((base?.amountCents ?? 0) / 100);
  const installPay =
    commission?.commissionType === 'fixed_amount_per_install'
      ? installConversionsSummary(commission.conversions as InstallConversion[] | undefined)
      : undefined;
  const basis =
    commission?.commissionType === 'fixed_amount_per_install'
      ? installPay ?? 'qualified app install'
      : commission?.commissionType === 'fixed_amount_per_sale'
        ? 'attributed product sale'
        : commission?.commissionType === 'percentage_of_platform_commission'
          ? 'platform commission from attributed sales'
          : 'eligible sales attributed to the creator';
  const variablePay =
    commission?.commissionType === 'fixed_amount_per_install'
      ? installPay && commission.conversions?.length
        ? basis
        : `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((commission.fixedAmountCents ?? 0) / 100)} per ${basis}`
      : commission?.commissionType === 'fixed_amount_per_sale'
        ? `${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((commission.fixedAmountCents ?? 0) / 100)} per ${basis}`
      : `${commission?.commissionPercent ?? 0}% of ${basis}`;
  const trigger =
    base?.trigger === 'custom'
      ? base.customTrigger
      : base?.trigger.replaceAll('_', ' ');
  return [
    ...promotedProducts(payment).flatMap(product=>[
      `Product to promote: ${product.title} — ${product.brandName}.`,
      `Product demo: ${product.previewUrl}`,
      ...(product.variants?[`Eligible variants: ${product.variants.map(v=>`${v.color} / ${v.size} (${v.currency} ${(v.priceCents/100).toFixed(2)} listed price)`).join('; ')}. Checkout uses current prices.`]:[]),
      'The demo link does not track sales or earn commission.',
    ]),
    `${base?.enabled ? `Base + Commission: ${amount} base per creator + ` : 'Commission only: '}${variablePay}.`,
    ...(base?.enabled
      ? [`Base payment earned when: ${trigger}.`]
      : ['No fixed base payment is included.']),
    `Attribution window: ${commission?.attributionWindowDays} days.`,
    commission?.terms,
    ...(commission?.rules ? [commissionRulesText(commission.rules)] : []),
    ...(commission?.fundingFlowVersion === 1 ? [
      commission?.commissionType === 'fixed_amount_per_install'
        ? 'ClothME handles payouts. Opening the install link only attributes the new user. Earnings are estimates until a selected conversion is reviewed. This campaign does not collect a prepaid install pool.'
        : 'ClothME handles payouts. Qualifying sales fund creator commission.',
      ...(base?.enabled ? ['The brand prepays the base for each creator slot. ClothME releases your base after the brand accepts your work. Unused slot funds return to the brand at campaign closure.'] : ['No brand deposit is required.']),
    ] : [
    `Payout handler: ${commission?.payoutHandler === 'clothme' ? 'ClothME' : commission?.payoutHandler === 'brand' ? 'Brand' : 'not specified'}.`,
    `Proposed funding: ${commission?.fundingSource?.replaceAll('_',' ') ?? 'not agreed'}.`,
    commission?.fundingTerms,
    'Funding requires a separate agreement and approval; these terms do not authorize a charge.'
    ]),
    'Commission estimates require review. Commission payouts are not automated.',
  ]
    .filter(Boolean)
    .join('\n');
}

/** Commission reuses the existing base/affiliate payload without legacy aliases. */
export function assertCommissionPayment(payment: CampaignPaymentDto): void {
  if (!isAttributedCommissionPayment(payment)) return;
  const base = payment.hybrid?.base;
  const commission = payment.hybrid?.affiliate;
  const rate = commission?.commissionPercent;
  const fixed = commission?.fixedAmountCents;
  const days = commission?.attributionWindowDays;
  if(commission?.rules){try{assertCommissionRules(commission.rules);}catch{throw new BadRequestException('Invalid commission payout rules');}}
  if (commission?.fundingFlowVersion === 1 && (commission.payoutHandler !== 'clothme' || commission.fundingSource !== 'brand' || (base?.enabled && base.trigger !== 'content_accepted'))) throw new BadRequestException('Campaign funding requires brand funding, ClothME payouts, and base release after work acceptance.');
  if(commission?.fundingSource==='shared_custom'&&!commission.fundingTerms?.trim()) throw new BadRequestException('Describe the proposed funding responsibilities.');
  const fail = (message: string): never => {
    throw new BadRequestException(message);
  };
  if (
    base?.enabled &&
    (!Number.isSafeInteger(base.amountCents) ||
      (base.amountCents ?? 0) < 0 ||
      (base.amountCents ?? 0) > 2_147_483_647 ||
      base.currency !== 'USD')
  ) {
    fail('Base + Commission requires a base payment of 0 or more in USD cents.');
  }
  if (
    base?.enabled &&
    (![
      'campaign_accepted',
      'contract_signed',
      'content_submitted',
      'content_accepted',
      'content_published',
      'campaign_completed',
      'custom',
    ].includes(base.trigger) ||
      (base.trigger === 'custom' && !base.customTrigger?.trim()))
  ) {
    fail('Specify when the base payment is earned.');
  }
  if (
    !commission ||
    !commission.enabled ||
    commission.currency !== 'USD' ||
    ![
      'percentage_of_sale',
      'percentage_of_platform_commission',
      'fixed_amount_per_sale',
      'fixed_amount_per_install',
    ].includes(commission.commissionType)
  ) {
    fail(
      payment.model === 'app_install'
        ? 'App install campaigns pay a fixed amount per qualified install.'
        : 'Choose product sale or platform commission as the payout event.',
    );
  }
  const accepted = commission!;
  if (payment.model === 'app_install' && accepted.commissionType !== 'fixed_amount_per_install') {
    fail('App install campaigns pay a fixed amount per qualified install.');
  }
  if (
    payment.model === 'product_commission' &&
    accepted.commissionType === 'fixed_amount_per_install'
  ) {
    fail('Product commission campaigns cannot use app install payouts.');
  }
  if (accepted.commissionType === 'fixed_amount_per_install') {
    assertInstallConversions(accepted, fail);
  } else if (accepted.commissionType === 'fixed_amount_per_sale') {
    if (
      !Number.isSafeInteger(fixed) ||
      (fixed ?? 0) <= 0 ||
      (fixed ?? 0) > 2_147_483_647
    ) {
      fail('Per-sale payout must be a positive USD cents amount.');
    }
  } else if (
      typeof rate !== 'number' ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      rate > 100 ||
      Math.abs(rate * 100 - Math.round(rate * 100)) > 0.000001
    ) {
      fail(
        'Commission rate must be greater than 0 and at most 100%, with at most two decimal places.',
      );
  }
  if (!Number.isInteger(days) || (days ?? 0) < 1 || (days ?? 0) > 365) {
    fail('Attribution window must be between 1 and 365 days.');
  }
  if (!commission?.terms?.trim() || commission.terms.length > 2000) {
    fail(
      'Describe eligible sales, refunds, and settlement timing in commission terms (up to 2000 characters).',
    );
  }
  if (
    payment.flatRateCents !== undefined ||
    payment.royaltyPercent !== undefined ||
    payment.milestones !== undefined ||
    payment.milestoneStructure !== undefined ||
    payment.hybrid?.milestones ||
    payment.hybrid?.creatorPool ||
    (['percentage_of_sale', 'percentage_of_platform_commission'].includes(accepted.commissionType) &&
      accepted.fixedAmountCents !== undefined) ||
    (accepted.commissionType === 'fixed_amount_per_sale' &&
      accepted.commissionPercent !== undefined) ||
    (accepted.commissionType === 'fixed_amount_per_install' &&
      accepted.commissionPercent !== undefined) ||
    (accepted.commissionType !== 'fixed_amount_per_install' &&
      (accepted.conversions !== undefined || accepted.installApp !== undefined)) ||
    (accepted.commissionType === 'fixed_amount_per_install' &&
      accepted.conversions?.length &&
      accepted.fixedAmountCents !== undefined)
  ) {
    fail(
      'Base + Commission supports only a base payment and one creator-attribution payout event.',
    );
  }
}

function assertInstallConversions(
  commission: NonNullable<CampaignPaymentDto['hybrid']>['affiliate'],
  fail: (message: string) => never,
) {
  const conversions = commission?.conversions;
  if (!conversions?.length) {
    const fixed = commission?.fixedAmountCents;
    if (
      !Number.isSafeInteger(fixed) ||
      (fixed ?? 0) <= 0 ||
      (fixed ?? 0) > 2_147_483_647
    ) {
      fail('Select at least one app install conversion event.');
    }
    return;
  }
  const app = commission?.installApp;
  if (!isInstallApp(app)) {
    fail('Choose the Customer or Vendor app for this install campaign.');
  }
  const seen = new Set<string>();
  for (const row of conversions) {
    if (!isInstallConversionEvent(row.event)) {
      fail('Unknown app install conversion event.');
    }
    if (!eventMatchesInstallApp(app, row.event)) {
      fail('Conversion events must match the selected Customer or Vendor app.');
    }
    if (seen.has(row.event)) fail('Each conversion event can be selected once.');
    seen.add(row.event);
    if (
      row.amountCents !== undefined &&
      (!Number.isSafeInteger(row.amountCents) ||
        row.amountCents < 1 ||
        row.amountCents > 2_147_483_647)
    ) {
      fail('Leave the earning blank for no payout, or enter a positive USD cents amount.');
    }
    if (row.event === 'x_products_listed') {
      if (
        !Number.isSafeInteger(row.listedProductCount) ||
        (row.listedProductCount ?? 0) < 1 ||
        (row.listedProductCount ?? 0) > 10_000
      ) {
        fail('Set how many listed products qualify for that conversion.');
      }
    } else if (row.listedProductCount !== undefined) {
      fail('Only the X products listed event uses a product count.');
    }
  }
}
