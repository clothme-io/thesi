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
    `Base + Commission: ${amount} base per creator + ${commission?.commissionPercent ?? 0}% of ${basis}.`,
    `Base payment earned when: ${trigger}.`,
    `Attribution window: ${commission?.attributionWindowDays} days.`,
    commission?.terms,
    'Sales tracking and commission payouts are not automated.',
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
  const fail = (message: string): never => {
    throw new BadRequestException(message);
  };
  if (
    !base?.enabled ||
    !Number.isSafeInteger(base.amountCents) ||
    (base.amountCents ?? 0) <= 0 ||
    (base.amountCents ?? 0) > 2_147_483_647 ||
    base.currency !== 'USD'
  ) {
    fail('Base + Commission requires a positive base payment in USD cents.');
  }
  if (
    !base ||
    ![
      'campaign_accepted',
      'contract_signed',
      'content_submitted',
      'content_accepted',
      'content_published',
      'campaign_completed',
      'custom',
    ].includes(base.trigger) ||
    (base.trigger === 'custom' && !base.customTrigger?.trim())
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
