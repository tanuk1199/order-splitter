import { adminGraphQL } from "../shopify/client";
import { GET_ORDER_WITH_PRODUCT_TAGS } from "../shopify/queries";
import {
  ORDER_CANCEL,
  DRAFT_ORDER_CREATE,
  DRAFT_ORDER_COMPLETE,
  TAGS_ADD,
  ORDER_UPDATE,
} from "../shopify/mutations";
import type {
  GetOrderResult,
  OrderCancelResult,
  DraftOrderCreateResult,
  DraftOrderCompleteResult,
  TagsAddResult,
  OrderUpdateResult,
  ShopifyLineItem,
} from "../shopify/types";
import { classifyLineItems, needsSplit } from "./classifier";
import { splitShipping } from "./shipping";
import { splitDiscount } from "./discounts";
import { buildDraftOrderInput } from "./draft-order-builder";
import { CONFIG } from "../config";
import { log } from "../logger";

export type SplitResult =
  | { action: "skipped"; reason: string }
  | { action: "no-split-needed" }
  | {
      action: "split";
      usOrderId: string;
      usOrderName: string;
      nonUsOrderId: string;
      nonUsOrderName: string;
    };

function calculateSubtotal(items: ShopifyLineItem[]): number {
  return items.reduce((sum, item) => {
    const unitPrice = parseFloat(
      item.originalUnitPriceSet.shopMoney.amount
    );
    return sum + unitPrice * item.quantity;
  }, 0);
}

export async function processOrderSplit(
  shopifyOrderGid: string
): Promise<SplitResult> {
  // 1. Fetch full order with product tags
  const { order } = await adminGraphQL<GetOrderResult>(
    GET_ORDER_WITH_PRODUCT_TAGS,
    { id: shopifyOrderGid }
  );

  if (!order) {
    return { action: "skipped", reason: "Order not found" };
  }

  // 2. Idempotency check via tags
  if (
    order.tags.includes(CONFIG.splitOrderTag) ||
    order.tags.includes(CONFIG.splitProcessedTag)
  ) {
    log("info", "Skipping already-processed order", {
      orderId: order.id,
      orderName: order.name,
    });
    return { action: "skipped", reason: "Already processed" };
  }

  // 3. Classify line items
  const classified = classifyLineItems(order.lineItems.nodes);

  if (!needsSplit(classified)) {
    log("info", "No split needed — all items in same group", {
      orderId: order.id,
      orderName: order.name,
      usCount: classified.usItems.length,
      nonUsCount: classified.nonUsItems.length,
    });
    return { action: "no-split-needed" };
  }

  log("info", "Splitting order", {
    orderId: order.id,
    orderName: order.name,
    usItems: classified.usItems.length,
    nonUsItems: classified.nonUsItems.length,
  });

  // 4. Calculate subtotals for proportional discount splitting
  const usSubtotal = calculateSubtotal(classified.usItems);
  const nonUsSubtotal = calculateSubtotal(classified.nonUsItems);

  // 5. Split shipping (full on US, $0 on non-US)
  const firstShippingLine = order.shippingLines.nodes[0];
  const shippingAllocation = splitShipping(
    firstShippingLine?.title ?? "Shipping",
    firstShippingLine?.originalPriceSet.shopMoney.amount ?? "0"
  );

  // 6. Split discounts proportionally
  const discountAllocation = splitDiscount(
    order.totalDiscountsSet.shopMoney.amount,
    usSubtotal,
    nonUsSubtotal
  );

  // 7. Tag original order BEFORE cancelling (idempotency safety)
  await adminGraphQL<TagsAddResult>(TAGS_ADD, {
    id: order.id,
    tags: [CONFIG.splitProcessedTag],
  });

  // 8. Cancel original order — no refund, restock inventory, no customer email
  const cancelResult = await adminGraphQL<OrderCancelResult>(ORDER_CANCEL, {
    orderId: order.id,
    reason: "OTHER",
    restock: true,
    notifyCustomer: false,
    staffNote: `Auto-split into US / non-US fulfillment orders`,
    refundMethod: { originalPaymentMethodsRefund: false },
  });

  if (cancelResult.orderCancel.userErrors.length > 0) {
    const errors = cancelResult.orderCancel.userErrors
      .map((e) => e.message)
      .join("; ");
    throw new Error(`Failed to cancel order: ${errors}`);
  }

  // 9. Create draft order for US items
  const usDraftInput = buildDraftOrderInput({
    order,
    lineItems: classified.usItems,
    label: "US",
    shipping: shippingAllocation.usShipping,
    discount: discountAllocation.usDiscount,
  });

  const usDraft = await adminGraphQL<DraftOrderCreateResult>(
    DRAFT_ORDER_CREATE,
    { input: usDraftInput }
  );

  if (usDraft.draftOrderCreate.userErrors.length > 0) {
    const errors = usDraft.draftOrderCreate.userErrors
      .map((e) => e.message)
      .join("; ");
    throw new Error(`Failed to create US draft order: ${errors}`);
  }

  // 10. Create draft order for non-US items
  const nonUsDraftInput = buildDraftOrderInput({
    order,
    lineItems: classified.nonUsItems,
    label: "non-US",
    shipping: shippingAllocation.nonUsShipping,
    discount: discountAllocation.nonUsDiscount,
  });

  const nonUsDraft = await adminGraphQL<DraftOrderCreateResult>(
    DRAFT_ORDER_CREATE,
    { input: nonUsDraftInput }
  );

  if (nonUsDraft.draftOrderCreate.userErrors.length > 0) {
    const errors = nonUsDraft.draftOrderCreate.userErrors
      .map((e) => e.message)
      .join("; ");
    throw new Error(`Failed to create non-US draft order: ${errors}`);
  }

  // 11. Complete both drafts (marks as paid without charging)
  const [usComplete, nonUsComplete] = await Promise.all([
    adminGraphQL<DraftOrderCompleteResult>(DRAFT_ORDER_COMPLETE, {
      id: usDraft.draftOrderCreate.draftOrder!.id,
    }),
    adminGraphQL<DraftOrderCompleteResult>(DRAFT_ORDER_COMPLETE, {
      id: nonUsDraft.draftOrderCreate.draftOrder!.id,
    }),
  ]);

  if (usComplete.draftOrderComplete.userErrors.length > 0) {
    const errors = usComplete.draftOrderComplete.userErrors
      .map((e) => e.message)
      .join("; ");
    throw new Error(`Failed to complete US draft order: ${errors}`);
  }

  if (nonUsComplete.draftOrderComplete.userErrors.length > 0) {
    const errors = nonUsComplete.draftOrderComplete.userErrors
      .map((e) => e.message)
      .join("; ");
    throw new Error(`Failed to complete non-US draft order: ${errors}`);
  }

  const usOrder = usComplete.draftOrderComplete.draftOrder!.order!;
  const nonUsOrder = nonUsComplete.draftOrderComplete.draftOrder!.order!;

  // 12. Store mapping on original order as metafield
  try {
    await adminGraphQL<OrderUpdateResult>(ORDER_UPDATE, {
      input: {
        id: order.id,
        metafields: [
          {
            namespace: "order_splitter",
            key: "split_orders",
            value: JSON.stringify({
              usOrderId: usOrder.id,
              usOrderName: usOrder.name,
              nonUsOrderId: nonUsOrder.id,
              nonUsOrderName: nonUsOrder.name,
            }),
            type: "json",
          },
        ],
      },
    });
  } catch (err) {
    // Non-critical — log but don't fail the split
    log("warn", "Failed to store split mapping metafield", {
      orderId: order.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  log("info", "Order split complete", {
    originalOrder: order.name,
    usOrder: usOrder.name,
    nonUsOrder: nonUsOrder.name,
  });

  return {
    action: "split",
    usOrderId: usOrder.id,
    usOrderName: usOrder.name,
    nonUsOrderId: nonUsOrder.id,
    nonUsOrderName: nonUsOrder.name,
  };
}
