import { timingSafeEqual } from "crypto";
import { CONFIG } from "./config";

export function verifyAdminAuth(authHeader: string | null): boolean {
  if (!authHeader) return false;

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0] !== "Bearer") return false;

  const token = parts[1];

  try {
    return timingSafeEqual(
      Buffer.from(token, "utf8"),
      Buffer.from(CONFIG.adminPassword, "utf8")
    );
  } catch {
    return false;
  }
}
