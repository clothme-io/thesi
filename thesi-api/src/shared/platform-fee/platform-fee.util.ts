/** Platform fee cap in cents ($250). */
export const PLATFORM_FEE_CAP_CENTS = 25_000;

/** Platform fee rate (2%). */
export const PLATFORM_FEE_RATE = 0.02;

export type CampaignPaymentForFee = {
  model: string;
  flatRateCents?: number;
  milestones?: Array<{ amountCents: number }>;
};

/**
 * Campaign platform fee: min($250, 2% of total brand-to-creator payout).
 * When 2% exceeds $250, charge $250. When 2% is less, charge 2%.
 */
export function calculatePlatformFeeCents(totalPayoutCents: number): number {
  if (totalPayoutCents <= 0) return 0;
  const percentageFee = Math.round(totalPayoutCents * PLATFORM_FEE_RATE);
  return Math.min(PLATFORM_FEE_CAP_CENTS, percentageFee);
}

/**
 * Payout base used for fee calculation.
 * flat_rate → flatRateCents; milestone → sum milestones; royalty/hybrid → flat portion only.
 */
export function campaignPayoutCents(payment: CampaignPaymentForFee): number {
  switch (payment.model) {
    case 'flat_rate':
    case 'hybrid':
    case 'royalty':
      return Math.max(0, payment.flatRateCents ?? 0);
    case 'milestone':
      return Math.max(
        0,
        (payment.milestones ?? []).reduce(
          (sum, item) => sum + (item.amountCents ?? 0),
          0,
        ),
      );
    default:
      return Math.max(0, payment.flatRateCents ?? 0);
  }
}

export function previewPlatformFee(payment: CampaignPaymentForFee): {
  payoutCents: number;
  feeCents: number;
  feeCapCents: number;
  feeRate: number;
  capped: boolean;
} {
  const payoutCents = campaignPayoutCents(payment);
  const uncapped = Math.round(payoutCents * PLATFORM_FEE_RATE);
  const feeCents = calculatePlatformFeeCents(payoutCents);
  return {
    payoutCents,
    feeCents,
    feeCapCents: PLATFORM_FEE_CAP_CENTS,
    feeRate: PLATFORM_FEE_RATE,
    capped: payoutCents > 0 && uncapped > PLATFORM_FEE_CAP_CENTS,
  };
}
