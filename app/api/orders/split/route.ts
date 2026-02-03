import { NextRequest } from "next/server";
import { verifyAdminAuth } from "@/lib/auth";
import { adminGraphQL } from "@/lib/shopify/client";
import { GET_ORDER_BY_NUMBER } from "@/lib/shopify/queries";
import type { GetOrderByNumberResult } from "@/lib/shopify/types";
import { processOrderSplit } from "@/lib/order-splitter/splitter";
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
    log("info", "Manual split triggered", { orderGid });
    const result = await processOrderSplit(orderGid);
    log("info", "Manual split complete", { orderGid, result });
    return jsonResponse(result);
  } catch (error) {
    log("error", "Manual split failed", {
      orderGid,
      error: error instanceof Error ? error.message : String(error),
    });
    return jsonResponse(
      {
        error:
          error instanceof Error ? error.message : "Split failed",
      },
      500
    );
  }
}
