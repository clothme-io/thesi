/** Platform fee cap in cents ($250). */
export const PLATFORM_FEE_CAP_CENTS = 25_000;

/** Platform fee rate (2%). */
export const PLATFORM_FEE_RATE = 0.02;

/**
 * Campaign platform fee: min($250, 2% of total brand-to-creator payout).
 * When 2% exceeds $250, charge $250. When 2% is less, charge 2%.
 */
export function calculatePlatformFeeCents(totalPayoutCents: number): number {
  if (totalPayoutCents <= 0) return 0;
  const percentageFee = Math.round(totalPayoutCents * PLATFORM_FEE_RATE);
  return Math.min(PLATFORM_FEE_CAP_CENTS, percentageFee);
}
