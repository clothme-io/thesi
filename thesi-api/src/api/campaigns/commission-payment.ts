import { assertCommissionRules, commissionRulesText } from './commission-rules';
import { promotedProducts } from './promoted-products';
import { BadRequestException } from '@nestjs/common';
import type { CampaignPaymentDto } from './dto/campaign.dto';

export function commissionInviteTerms(payment: CampaignPaymentDto): string {
  const base = payment.hybrid?.base;
  const commission = payment.hybrid?.affiliate;
  const amount = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format((base?.amountCents ?? 0) / 100);
  const basis =
    commission?.commissionType === 'percentage_of_platform_commission'
      ? 'platform commission from attributed sales'
      : 'eligible sales attributed to the creator';
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
    `${base?.enabled ? `Base + Commission: ${amount} base per creator + ` : 'Commission only: '}${commission?.commissionPercent ?? 0}% of ${basis}.`,
    ...(base?.enabled
      ? [`Base payment earned when: ${trigger}.`]
      : ['No fixed base payment is included.']),
    `Attribution window: ${commission?.attributionWindowDays} days.`,
    commission?.terms,
    ...(commission?.rules ? [commissionRulesText(commission.rules)] : []),
    ...(commission?.fundingFlowVersion === 1 ? [
      'ClothME handles payouts. Qualifying sales fund creator commission.',
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
  if (payment.model !== 'commission') return;
  const base = payment.hybrid?.base;
  const commission = payment.hybrid?.affiliate;
  const rate = commission?.commissionPercent;
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
      (base.amountCents ?? 0) <= 0 ||
      (base.amountCents ?? 0) > 2_147_483_647 ||
      base.currency !== 'USD')
  ) {
    fail('Base + Commission requires a positive base payment in USD cents.');
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
    !commission?.enabled ||
    commission.currency !== 'USD' ||
    !['percentage_of_sale', 'percentage_of_platform_commission'].includes(
      commission.commissionType,
    )
  ) {
    fail(
      'Choose eligible sales or platform commission as the commission base.',
    );
  }
  if (
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
    commission?.fixedAmountCents !== undefined
  ) {
    fail(
      'Base + Commission supports only a base payment and percentage commission.',
    );
  }
}
