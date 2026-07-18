export const PLATFORM_FEE_CAP_CENTS = 25_000;
export const PLATFORM_FEE_RATE = 0.02;

export function calculatePlatformFeeCents(totalPayoutCents: number): number {
  if (totalPayoutCents <= 0) return 0;
  const percentageFee = Math.round(totalPayoutCents * PLATFORM_FEE_RATE);
  return Math.min(PLATFORM_FEE_CAP_CENTS, percentageFee);
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}
