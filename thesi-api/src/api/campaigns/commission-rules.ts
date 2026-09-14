export type CommissionRules = {
  version: 1;
  reviewDays: number;
  payoutFrequency: 'on_approval' | 'weekly' | 'monthly';
  minimumPayoutCents: number;
  creatorFeeCents: 0;
  creditPolicy: 'hold_until_verified';
  selfReferralPolicy: 'hold_until_reviewed';
};
export const DEFAULT_COMMISSION_RULES: CommissionRules = {
  version: 1,
  reviewDays: 30,
  payoutFrequency: 'on_approval',
  minimumPayoutCents: 0,
  creatorFeeCents: 0,
  creditPolicy: 'hold_until_verified',
  selfReferralPolicy: 'hold_until_reviewed',
};
export function assertCommissionRules(
  value: unknown,
): asserts value is CommissionRules {
  const r = value as CommissionRules;
  if (
    !r ||
    r.version !== 1 ||
    !Number.isInteger(r.reviewDays) ||
    r.reviewDays < 0 ||
    r.reviewDays > 365 ||
    !['on_approval', 'weekly', 'monthly'].includes(r.payoutFrequency) ||
    !Number.isSafeInteger(r.minimumPayoutCents) ||
    r.minimumPayoutCents < 0 ||
    r.minimumPayoutCents > 2147483647 ||
    r.creatorFeeCents !== 0 ||
    r.creditPolicy !== 'hold_until_verified' ||
    r.selfReferralPolicy !== 'hold_until_reviewed'
  )
    throw new Error('Invalid commission payout rules');
}
/** Eligibility dates are UTC; approval is still required. This does not schedule transfers. */
export function commissionEligibleAt(
  purchasedAt: string,
  rules: CommissionRules,
): string {
  assertCommissionRules(rules);
  const d = new Date(Date.parse(purchasedAt) + rules.reviewDays * 86400000);
  if (!Number.isFinite(d.getTime())) throw new Error('Invalid purchase date');
  if (rules.payoutFrequency === 'weekly') {
    // First Monday midnight at or after the completed review period.
    const sameMidnight =
      d.getUTCHours() === 0 &&
      d.getUTCMinutes() === 0 &&
      d.getUTCSeconds() === 0 &&
      d.getUTCMilliseconds() === 0;
    let days = (8 - d.getUTCDay()) % 7;
    if (!days && !sameMidnight) days = 7;
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(0, 0, 0, 0);
  } else if (rules.payoutFrequency === 'monthly') {
    if (
      d.getUTCDate() !== 1 ||
      d.getUTCHours() ||
      d.getUTCMinutes() ||
      d.getUTCSeconds() ||
      d.getUTCMilliseconds()
    )
      d.setUTCMonth(d.getUTCMonth() + 1, 1);
    d.setUTCHours(0, 0, 0, 0);
  }
  return d.toISOString();
}
export function commissionRulesText(rules: CommissionRules): string {
  assertCommissionRules(rules);
  return `Sale review: ${rules.reviewDays} days. Payout eligibility: ${rules.payoutFrequency.replaceAll('_', ' ')}${rules.payoutFrequency === 'weekly' ? ' (Monday UTC)' : rules.payoutFrequency === 'monthly' ? ' (first day of month UTC)' : ''}; approval required. Minimum individual commission transfer: USD ${(rules.minimumPayoutCents / 100).toFixed(2)}. No extra creator payout fee. Credit-funded sales and suspected self-referrals are held for verification. Scheduled batches and combined balances are separate from individual approvals.`;
}
