export interface ShippingAllocation {
  usShipping: { title: string; price: string };
  nonUsShipping: { title: string; price: string };
}

/**
 * Allocates shipping cost: full amount on the US order, $0 on non-US.
 */
export function splitShipping(
  originalTitle: string,
  originalAmount: string
): ShippingAllocation {
  return {
    usShipping: {
      title: originalTitle,
      price: parseFloat(originalAmount).toFixed(2),
    },
    nonUsShipping: {
      title: originalTitle,
      price: "0.00",
    },
  };
}
