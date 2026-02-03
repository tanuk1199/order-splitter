import { NextRequest } from "next/server";
import { verifyShopifyWebhook } from "@/lib/webhooks/verify";
import { processOrderSplit } from "@/lib/order-splitter/splitter";
import { CONFIG } from "@/lib/config";
import { log } from "@/lib/logger";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const hmacHeader = request.headers.get("x-shopify-hmac-sha256");

  if (!hmacHeader) {
    log("warn", "Missing HMAC header");
    return new Response("Unauthorized", { status: 401 });
  }

  if (!verifyShopifyWebhook(rawBody, hmacHeader)) {
    log("warn", "HMAC verification failed");
    return new Response("Unauthorized", { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    log("error", "Failed to parse webhook payload");
    return new Response("Bad Request", { status: 400 });
  }

  const orderId = payload.admin_graphql_api_id as string;
  const orderTags = (payload.tags as string) ?? "";

  log("info", "Received orders/paid webhook", {
    orderId,
    orderName: payload.name,
  });

  // Fast-path: skip if this order is already a split order (check webhook payload tags)
  const tagList = orderTags.split(",").map((t) => t.trim());
  if (
    tagList.includes(CONFIG.splitOrderTag) ||
    tagList.includes(CONFIG.splitProcessedTag)
  ) {
    log("info", "Skipping — split/processed tag found in webhook payload", {
      orderId,
    });
    return new Response("OK", { status: 200 });
  }

  try {
    const result = await processOrderSplit(orderId);
    log("info", "Processing complete", { orderId, result });
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    log("error", "Order split failed", {
      orderId,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    // Return 500 so Shopify retries the webhook
    return new Response("Internal Server Error", { status: 500 });
  }
}
