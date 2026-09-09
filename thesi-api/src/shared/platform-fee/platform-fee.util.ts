/** Platform fee cap in cents ($79). */
export const PLATFORM_FEE_CAP_CENTS = 7_900;

/** Platform fee rate (2%). */
export const PLATFORM_FEE_RATE = 0.02;

export type CampaignPaymentForFee = {
  model: string;
  flatRateCents?: number;
  milestoneStructure?: 'cumulative' | 'highest_achieved';
  milestones?: Array<{ amountCents: number }>;
  hybrid?: {
    base?: { enabled: boolean; amountCents?: number };
    milestones?: {
      enabled: boolean;
      payoutMethod: 'cumulative' | 'highest_achieved';
      tiers: Array<{ amountCents: number }>;
    };
  };
};

/**
 * Campaign platform fee: min($79, 2% of total brand-to-creator payout).
 * When 2% exceeds $79, charge $79. When 2% is less, charge 2%.
 */
export function calculatePlatformFeeCents(totalPayoutCents: number): number {
  if (totalPayoutCents <= 0) return 0;
  const percentageFee = Math.round(totalPayoutCents * PLATFORM_FEE_RATE);
  return Math.min(PLATFORM_FEE_CAP_CENTS, percentageFee);
}

/**
 * Payout base used for fee calculation.
 * flat_rate → flatRateCents; milestone → selected milestone calculation;
 * hybrid → base plus configured performance milestone potential; royalty → flat portion only.
 */
export function campaignPayoutCents(payment: CampaignPaymentForFee): number {
  switch (payment.model) {
    case 'flat_rate':
    case 'royalty':
      return Math.max(0, payment.flatRateCents ?? 0);
    case 'hybrid': {
      const base = payment.hybrid?.base?.enabled
        ? payment.hybrid.base.amountCents ?? 0
        : payment.flatRateCents ?? 0;
      const tiers = payment.hybrid?.milestones?.enabled
        ? payment.hybrid.milestones.tiers
        : [];
      const milestoneTotal =
        payment.hybrid?.milestones?.payoutMethod === 'cumulative'
          ? tiers.reduce((sum, item) => sum + (item.amountCents ?? 0), 0)
          : Math.max(0, ...tiers.map((item) => item.amountCents ?? 0));
      return Math.max(0, base + milestoneTotal);
    }
    case 'milestone':
      if (payment.milestoneStructure === 'cumulative') {
        return Math.max(
          0,
          (payment.milestones ?? []).reduce(
            (sum, item) => sum + (item.amountCents ?? 0),
            0,
          ),
        );
      }
      return Math.max(
        0,
        ...(payment.milestones ?? []).map((item) => item.amountCents ?? 0),
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
