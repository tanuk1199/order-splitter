import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { CONFIG } from "@/lib/config";

export async function GET(request: NextRequest) {
  const shop = request.nextUrl.searchParams.get("shop") ?? CONFIG.shopDomain;

  // Generate a nonce for CSRF protection
  const nonce = randomBytes(16).toString("hex");

  // Build the redirect URI — same host as the incoming request
  const host = request.headers.get("host") ?? "localhost:3000";
  const protocol = host.startsWith("localhost") ? "http" : "https";
  const redirectUri = `${protocol}://${host}/api/auth/callback`;

  // Build Shopify OAuth authorize URL
  const authUrl = new URL(`https://${shop}/admin/oauth/authorize`);
  authUrl.searchParams.set("client_id", CONFIG.clientId);
  authUrl.searchParams.set("scope", CONFIG.scopes);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", nonce);

  // Store nonce in a cookie so we can verify it on callback
  const response = NextResponse.redirect(authUrl.toString());
  response.cookies.set("oauth_state", nonce, {
    httpOnly: true,
    secure: !host.startsWith("localhost"),
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  return response;
}
