import { BadRequestException } from '@nestjs/common';
import type { CampaignPaymentDto } from '../campaigns/dto/campaign.dto';
export function baseFundingPlan(
  payment: CampaignPaymentDto,
  capacity?: number | null,
) {
  if (payment.model !== 'commission' || !payment.hybrid?.base?.enabled)
    return { baseCents: 0, slots: capacity ?? 0, depositCents: 0 };
  const base = payment.hybrid.base;
  if (
    !Number.isSafeInteger(base.amountCents) ||
    base.amountCents! <= 0 ||
    base.currency !== 'USD' ||
    base.trigger !== 'content_accepted'
  )
    throw new BadRequestException(
      'An enabled base requires USD and release after brand acceptance of work',
    );
  if (!Number.isInteger(capacity) || capacity! <= 0)
    throw new BadRequestException(
      'Set the number of creator slots before funding',
    );
  const deposit = BigInt(base.amountCents!) * BigInt(capacity!);
  if (deposit > 99999999n)
    throw new BadRequestException(
      'Base deposit exceeds the supported payment limit',
    );
  return {
    baseCents: base.amountCents!,
    slots: capacity!,
    depositCents: Number(deposit),
  };
}
