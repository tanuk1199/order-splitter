# Order Splitter

Auto-splits Shopify orders containing mixed US and non-US fulfilled products into separate orders.

## How It Works

When an order is paid, the app checks if it contains a mix of US-tagged and non-US products. If so, it:

1. Tags the original order as `split-processed`
2. Cancels the original order (no refund, restocks inventory, no customer notification)
3. Creates a **US draft order** with US items + full shipping cost
4. Creates a **non-US draft order** with non-US items + $0 shipping
5. Completes both drafts as paid (without charging again)
6. Stores a mapping metafield on the original order linking to the two new orders

Products are classified by the `US` tag on the product in Shopify. Discounts are split proportionally by subtotal.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **Shopify Admin GraphQL API** (2025-07)
- **Vercel** for hosting
- No database — uses Shopify tags for idempotency

## Live URLs

- **Admin dashboard**: https://order-splitter.vercel.app/admin
- **Webhook endpoint**: https://order-splitter.vercel.app/api/webhooks/orders-paid
- **OAuth install**: https://order-splitter.vercel.app/api/auth
- **Health check**: https://order-splitter.vercel.app/api/health

## Store

- **Store**: earthlyblissco.myshopify.com
- **Shopify app**: Created via dev.shopify.com (OAuth required, no static tokens)

## Environment Variables

| Variable | Description |
|---|---|
| `SHOPIFY_STORE_DOMAIN` | e.g. `earthlyblissco.myshopify.com` |
| `SHOPIFY_CLIENT_ID` | Client ID from Shopify app settings |
| `SHOPIFY_CLIENT_SECRET` | Secret key from Shopify app settings (also used for webhook HMAC verification) |
| `SHOPIFY_ADMIN_ACCESS_TOKEN` | OAuth access token (`shpat_...`) — obtained via `/api/auth` flow |
| `SHOPIFY_API_VERSION` | `2025-07` |
| `ADMIN_PASSWORD` | Password for the `/admin` dashboard UI |
| `SPLIT_TAG` | (optional) Product tag for US items, defaults to `US` |

## OAuth Setup

The app uses Shopify OAuth with the Client ID and Client Secret. No separate webhook secret is needed.

1. Set `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` in env
2. Configure in Shopify app settings (dev.shopify.com):
   - **App URL**: `https://order-splitter.vercel.app/api/auth`
   - **Redirect URL**: `https://order-splitter.vercel.app/api/auth/callback`
   - **Scopes**: `read_orders,write_orders,read_products,write_draft_orders,read_customers`
3. Visit `/api/auth` to authorize — shows the access token once
4. Set that token as `SHOPIFY_ADMIN_ACCESS_TOKEN` on Vercel
5. The token does not expire. Only need to do this once.

For local dev, the token auto-saves to `.token.json` (gitignored).

## Webhook

Configured in Shopify admin → Settings → Notifications → Webhooks:

- **Event**: Order payment
- **Format**: JSON
- **URL**: `https://order-splitter.vercel.app/api/webhooks/orders-paid`
- **API version**: 2025-07

Webhook HMAC is verified using the `SHOPIFY_CLIENT_SECRET`.

## API Routes

| Route | Method | Auth | Purpose |
|---|---|---|---|
| `/api/auth` | GET | None | Initiates Shopify OAuth redirect |
| `/api/auth/callback` | GET | None | OAuth callback, exchanges code for access token |
| `/api/health` | GET | None | Health check |
| `/api/orders/preview` | POST | Bearer token | Preview order split without executing |
| `/api/orders/split` | POST | Bearer token | Execute the order split |
| `/api/webhooks/orders-paid` | POST | HMAC signature | Shopify webhook handler (auto-split on payment) |

## Local Development

```bash
npm install
npm run dev
```

Visit `http://localhost:3003/admin` for the dashboard.

## Key Files

```
app/api/auth/              OAuth flow
app/api/webhooks/          Webhook handler
app/admin/page.tsx         Admin dashboard UI
lib/order-splitter/        Core split logic (classifier, shipping, discounts, draft builder)
lib/shopify/               GraphQL client, queries, mutations, types, token store
lib/webhooks/verify.ts     HMAC webhook verification
lib/config.ts              Environment config
```
