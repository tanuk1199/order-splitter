import { createHmac, timingSafeEqual } from "crypto";
import { CONFIG } from "../config";

export function verifyShopifyWebhook(
  rawBody: string,
  hmacHeader: string
): boolean {
  const digest = createHmac("sha256", CONFIG.clientSecret)
    .update(rawBody, "utf8")
    .digest("base64");

  try {
    return timingSafeEqual(
      Buffer.from(digest, "utf8"),
      Buffer.from(hmacHeader, "utf8")
    );
  } catch {
    // Buffers of different lengths throw — treat as mismatch
    return false;
  }
}
