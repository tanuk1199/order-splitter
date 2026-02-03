import { CONFIG } from "../config";
import type { ShopifyLineItem } from "../shopify/types";

export interface ClassifiedItems {
  usItems: ShopifyLineItem[];
  nonUsItems: ShopifyLineItem[];
}

export function classifyLineItems(
  lineItems: ShopifyLineItem[]
): ClassifiedItems {
  const usItems: ShopifyLineItem[] = [];
  const nonUsItems: ShopifyLineItem[] = [];
  const tag = CONFIG.splitTag.toLowerCase();

  for (const item of lineItems) {
    const productTags = item.product?.tags ?? [];
    const hasTag = productTags.some((t) => t.toLowerCase() === tag);

    if (hasTag) {
      usItems.push(item);
    } else {
      nonUsItems.push(item);
    }
  }

  return { usItems, nonUsItems };
}

/** Returns true only if the order contains BOTH US and non-US items */
export function needsSplit(classified: ClassifiedItems): boolean {
  return classified.usItems.length > 0 && classified.nonUsItems.length > 0;
}
