import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const TOKEN_FILE = join(process.cwd(), ".token.json");

/** In-memory cache so we only read the file once per cold start */
let cached: string | null = null;

export function getAccessToken(): string {
  // 1. Check env var (set manually on Vercel after first OAuth)
  if (process.env.SHOPIFY_ADMIN_ACCESS_TOKEN) {
    return process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  }

  // 2. Check in-memory cache
  if (cached) return cached;

  // 3. Read from file (local dev)
  try {
    const data = JSON.parse(readFileSync(TOKEN_FILE, "utf8"));
    if (data.accessToken) {
      cached = data.accessToken as string;
      return cached!;
    }
  } catch {
    // File doesn't exist yet — app hasn't been installed
  }

  throw new Error(
    "No Shopify access token found. Visit /api/auth to install the app."
  );
}

export function saveAccessToken(token: string): void {
  cached = token;
  try {
    writeFileSync(TOKEN_FILE, JSON.stringify({ accessToken: token }), "utf8");
  } catch {
    // On Vercel the filesystem is read-only — that's fine,
    // the token is still cached in memory for this invocation
  }
}
