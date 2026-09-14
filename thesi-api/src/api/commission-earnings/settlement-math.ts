export type SettlementTotals = {
  reserved: number;
  creatorPaid: number;
  creatorRecovered: number;
  vendorReturned: number;
  vendorRecovered: number;
  refundOffset: number;
};
/** Reserve reductions caused by refunds fund the customer refund; they are not also returned to the vendor. */
export function settlementPlan(
  t: SettlementTotals,
  earned: number,
  refundReduction: number,
  qualified: boolean,
) {
  for (const n of [...Object.values(t), earned, refundReduction])
    if (!Number.isSafeInteger(n) || n < 0)
      throw new Error('Unsafe settlement money');
  const paid = t.creatorPaid - t.creatorRecovered,
    vendor = t.vendorReturned - t.vendorRecovered;
  const available = t.reserved - paid - vendor - t.refundOffset;
  if (
    paid < 0 ||
    vendor < 0 ||
    available < 0 ||
    earned + refundReduction > t.reserved ||
    refundReduction < t.refundOffset
  )
    throw new Error('Settlement balance requires reconciliation');
  if (paid > earned)
    return { kind: 'creator_reversal' as const, amount: paid - earned };
  const vendorTarget = t.reserved - earned - refundReduction;
  if (vendor > vendorTarget)
    return { kind: 'vendor_reversal' as const, amount: vendor - vendorTarget };
  if (refundReduction > t.refundOffset) {
    const amount = refundReduction - t.refundOffset;
    if (amount > available)
      throw new Error('Recover paid funds before refund allocation');
    return { kind: 'refund_offset' as const, amount };
  }
  if (vendorTarget > vendor)
    return { kind: 'vendor_return' as const, amount: vendorTarget - vendor };
  if (qualified && earned > paid) {
    if (earned - paid > available)
      throw new Error('Insufficient reserved proceeds');
    return { kind: 'creator_transfer' as const, amount: earned - paid };
  }
  return null;
}
