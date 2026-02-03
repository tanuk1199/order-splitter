export const CONFIG = {
  /** Product tag that identifies US-fulfilled items */
  splitTag: process.env.SPLIT_TAG ?? "US",

  /** Tag applied to split orders to prevent re-processing */
  splitOrderTag: "split-order",

  /** Tag applied to original order after split is initiated */
  splitProcessedTag: "split-processed",

  /** Prefix for tag linking split orders back to original */
  splitFromPrefix: "split-from-",

  shopDomain: process.env.SHOPIFY_STORE_DOMAIN!,
  clientId: process.env.SHOPIFY_CLIENT_ID!,
  clientSecret: process.env.SHOPIFY_CLIENT_SECRET!,
  apiVersion: process.env.SHOPIFY_API_VERSION ?? "2025-07",

  adminPassword: process.env.ADMIN_PASSWORD!,

  /** OAuth scopes needed by the app */
  scopes:
    "read_orders,write_orders,read_products,write_draft_orders,read_customers",
} as const;
