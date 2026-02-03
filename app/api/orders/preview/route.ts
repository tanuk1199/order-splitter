import { NextRequest } from "next/server";
import { verifyAdminAuth } from "@/lib/auth";
import { adminGraphQL } from "@/lib/shopify/client";
import {
  GET_ORDER_WITH_PRODUCT_TAGS,
  GET_ORDER_BY_NUMBER,
} from "@/lib/shopify/queries";
import type {
  GetOrderResult,
  GetOrderByNumberResult,
} from "@/lib/shopify/types";
import {
  classifyLineItems,
  needsSplit,
} from "@/lib/order-splitter/classifier";
import { CONFIG } from "@/lib/config";
import { log } from "@/lib/logger";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(request: NextRequest) {
  if (!verifyAdminAuth(request.headers.get("authorization"))) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  let body: { orderNumber?: string; orderId?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  // Resolve order GID
  let orderGid: string;

  if (body.orderId) {
    orderGid = body.orderId;
  } else if (body.orderNumber) {
    const cleaned = body.orderNumber.replace("#", "").trim();
    const result = await adminGraphQL<GetOrderByNumberResult>(
      GET_ORDER_BY_NUMBER,
      { query: `name:#${cleaned}` }
    );
    if (!result.orders.nodes.length) {
      return jsonResponse({ error: `Order #${cleaned} not found` }, 404);
    }
    orderGid = result.orders.nodes[0].id;
  } else {
    return jsonResponse(
      { error: "Provide orderNumber or orderId" },
      400
    );
  }

  try {
    const { order } = await adminGraphQL<GetOrderResult>(
      GET_ORDER_WITH_PRODUCT_TAGS,
      { id: orderGid }
    );

    if (!order) {
      return jsonResponse({ error: "Order not found" }, 404);
    }

    const classified = classifyLineItems(order.lineItems.nodes);

    return jsonResponse({
      order: {
        id: order.id,
        name: order.name,
        tags: order.tags,
        email: order.email,
        shippingAddress: order.shippingAddress,
        totalShipping: order.totalShippingPriceSet.shopMoney.amount,
        totalDiscount: order.totalDiscountsSet.shopMoney.amount,
        currency: order.totalShippingPriceSet.shopMoney.currencyCode,
      },
      usItems: classified.usItems.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.originalUnitPriceSet.shopMoney.amount,
        productTags: item.product?.tags ?? [],
      })),
      nonUsItems: classified.nonUsItems.map((item) => ({
        title: item.title,
        quantity: item.quantity,
        unitPrice: item.originalUnitPriceSet.shopMoney.amount,
        productTags: item.product?.tags ?? [],
      })),
      splitNeeded: needsSplit(classified),
      alreadyProcessed:
        order.tags.includes(CONFIG.splitOrderTag) ||
        order.tags.includes(CONFIG.splitProcessedTag),
    });
  } catch (error) {
    log("error", "Preview fetch failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : "Preview failed",
      },
      500
    );
  }
}
