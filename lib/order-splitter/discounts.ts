export interface DiscountSplit {
  usDiscount: { value: number; title: string } | null;
  nonUsDiscount: { value: number; title: string } | null;
}

/**
 * Splits the total order discount proportionally by subtotal weight.
 * Returns null for a group if its share rounds to $0.
 */
export function splitDiscount(
  totalDiscountAmount: string,
  usSubtotal: number,
  nonUsSubtotal: number
): DiscountSplit {
  const discount = parseFloat(totalDiscountAmount);
  if (discount === 0) return { usDiscount: null, nonUsDiscount: null };

  const combined = usSubtotal + nonUsSubtotal;
  if (combined === 0) return { usDiscount: null, nonUsDiscount: null };

  const usShare = parseFloat(
    ((usSubtotal / combined) * discount).toFixed(2)
  );
  const nonUsShare = parseFloat((discount - usShare).toFixed(2));

  const title = "Proportional discount from original order";

  return {
    usDiscount: usShare > 0 ? { value: usShare, title } : null,
    nonUsDiscount: nonUsShare > 0 ? { value: nonUsShare, title } : null,
  };
}
