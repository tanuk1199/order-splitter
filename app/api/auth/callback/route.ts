import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { CONFIG } from "@/lib/config";
import { saveAccessToken } from "@/lib/shopify/token-store";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const shop = params.get("shop");
  const code = params.get("code");
  const state = params.get("state");
  const hmac = params.get("hmac");

  // Verify state matches cookie
  const savedState = request.cookies.get("oauth_state")?.value;
  if (!state || state !== savedState) {
    return new Response("Invalid state parameter", { status: 403 });
  }

  if (!shop || !code || !hmac) {
    return new Response("Missing required parameters", { status: 400 });
  }

  // Verify HMAC from Shopify
  const queryParams = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (key !== "hmac") queryParams.set(key, value);
  }
  // Sort params alphabetically for HMAC verification
  const sorted = new URLSearchParams(
    [...queryParams.entries()].sort(([a], [b]) => a.localeCompare(b))
  );
  const digest = createHmac("sha256", CONFIG.clientSecret)
    .update(sorted.toString())
    .digest("hex");

  if (digest !== hmac) {
    return new Response("HMAC verification failed", { status: 403 });
  }

  // Exchange code for access token
  const tokenRes = await fetch(
    `https://${shop}/admin/oauth/access_token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: CONFIG.clientId,
        client_secret: CONFIG.clientSecret,
        code,
      }),
    }
  );

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    return new Response(`Token exchange failed: ${text}`, { status: 502 });
  }

  const { access_token } = await tokenRes.json();

  // Save the token
  saveAccessToken(access_token);

  // Return a page showing the token so the user can set it as an env var on Vercel
  const html = `<!DOCTYPE html>
<html>
<head><title>App Installed</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 600px; margin: 60px auto; padding: 0 20px; color: #1a1a1a; }
  h1 { font-size: 22px; }
  .token-box { background: #f5f5f5; border: 1px solid #ddd; border-radius: 6px; padding: 16px; margin: 16px 0; word-break: break-all; font-family: monospace; font-size: 13px; }
  .note { font-size: 14px; color: #555; margin: 12px 0; }
  a { color: #2c6ecb; }
  .success { background: #d4edda; border: 1px solid #28a745; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; }
</style>
</head>
<body>
  <div class="success">App installed successfully!</div>
  <h1>Your Access Token</h1>
  <p class="note">The token has been saved automatically for local development.</p>
  <p class="note"><strong>For Vercel deployment:</strong> Copy this token and add it as <code>SHOPIFY_ADMIN_ACCESS_TOKEN</code> in your Vercel environment variables.</p>
  <div class="token-box">${access_token}</div>
  <p class="note">This token does not expire. You only need to do this once.</p>
  <p><a href="/admin">Go to Admin Dashboard &rarr;</a></p>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}
