export type CommissionFacts = {
  currency: string;
  netSaleCents: number;
  platformFeeCents: number | null;
  fullyRefunded: boolean;
  refundedNetCents?: number;
  refundedPlatformFeeCents?: number;
  holdReasons: string[];
};
/** Integer cents, round down once per order line; never round individual units. */
export function commissionResult(
  facts: CommissionFacts,
  type: string,
  percent: number,
) {
  const reasons = [...facts.holdReasons];
  if (facts.currency !== 'USD') reasons.push('unsupported_currency');
  const refundedNet = facts.refundedNetCents ?? 0;
  if (
    !Number.isSafeInteger(refundedNet) ||
    refundedNet < 0 ||
    refundedNet > facts.netSaleCents
  )
    throw new Error('Invalid refunded merchandise amount');
  if (
    refundedNet > 0 &&
    type === 'percentage_of_platform_commission' &&
    !facts.fullyRefunded &&
    facts.refundedPlatformFeeCents === undefined
  )
    reasons.push('platform_fee_refund_requires_reconciliation');
  const reversed =
    facts.fullyRefunded ||
    (type === 'percentage_of_sale' &&
      facts.netSaleCents > 0 &&
      refundedNet === facts.netSaleCents);
  const refundedFee = facts.refundedPlatformFeeCents ?? 0;
  if (
    !Number.isSafeInteger(refundedFee) ||
    refundedFee < 0 ||
    refundedFee > (facts.platformFeeCents ?? 0)
  )
    throw new Error('Invalid refunded platform fee');
  const basis =
    type === 'percentage_of_sale'
      ? facts.netSaleCents - refundedNet
      : facts.platformFeeCents === null
        ? null
        : facts.platformFeeCents - refundedFee;
  if (basis === null) reasons.push('platform_fee_unavailable');
  if (
    !['percentage_of_sale', 'percentage_of_platform_commission'].includes(
      type,
    ) ||
    !Number.isFinite(percent) ||
    percent <= 0 ||
    percent > 100 ||
    Math.abs(percent * 100 - Math.round(percent * 100)) > 0.000001
  )
    throw new Error('Invalid accepted commission terms');
  for (const n of [facts.netSaleCents, facts.platformFeeCents ?? 0])
    if (!Number.isSafeInteger(n) || n < 0)
      throw new Error('Invalid monetary facts');
  const accruedCents = reversed
    ? 0
    : Number((BigInt(basis ?? 0) * BigInt(Math.round(percent * 100))) / 10000n);
  return {
    accruedCents,
    state: reversed ? 'reversed' : reasons.length ? 'held' : 'under_review',
    reasons: [...new Set(reasons)],
  };
}
