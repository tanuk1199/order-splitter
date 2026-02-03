"use client";

import { useState, useCallback, FormEvent } from "react";

// --- Types matching API responses ---

interface PreviewItem {
  title: string;
  quantity: number;
  unitPrice: string;
  productTags: string[];
}

interface PreviewOrder {
  id: string;
  name: string;
  tags: string[];
  email: string | null;
  shippingAddress: {
    firstName: string | null;
    lastName: string | null;
    city: string | null;
    province: string | null;
    country: string | null;
  } | null;
  totalShipping: string;
  totalDiscount: string;
  currency: string;
}

interface PreviewData {
  order: PreviewOrder;
  usItems: PreviewItem[];
  nonUsItems: PreviewItem[];
  splitNeeded: boolean;
  alreadyProcessed: boolean;
}

type SplitResult =
  | {
      action: "split";
      usOrderName: string;
      nonUsOrderName: string;
    }
  | { action: "skipped"; reason: string }
  | { action: "no-split-needed" };

// --- Parse order input ---

function parseOrderInput(input: string): {
  orderNumber?: string;
  orderId?: string;
} {
  const trimmed = input.trim();

  // Shopify admin URL: extract numeric order ID
  const urlMatch = trimmed.match(/\/orders\/(\d+)/);
  if (urlMatch) {
    return { orderId: `gid://shopify/Order/${urlMatch[1]}` };
  }

  // Already a GID
  if (trimmed.startsWith("gid://")) {
    return { orderId: trimmed };
  }

  // Order number
  const cleaned = trimmed.replace("#", "").trim();
  if (cleaned) {
    return { orderNumber: cleaned };
  }

  return {};
}

// --- Component ---

export default function AdminPage() {
  // Auth
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    if (typeof window !== "undefined") {
      return sessionStorage.getItem("admin_token") !== null;
    }
    return false;
  });
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");

  // Order input
  const [orderInput, setOrderInput] = useState("");

  // Preview
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState("");

  // Split
  const [splitResult, setSplitResult] = useState<SplitResult | null>(null);
  const [splitLoading, setSplitLoading] = useState(false);
  const [splitError, setSplitError] = useState("");

  const getToken = useCallback(
    () => sessionStorage.getItem("admin_token") ?? "",
    []
  );

  // --- Auth ---

  const handleLogin = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      setAuthError("");
      sessionStorage.setItem("admin_token", password);
      setIsAuthenticated(true);
      setPassword("");
    },
    [password]
  );

  const handleLogout = useCallback(() => {
    sessionStorage.removeItem("admin_token");
    setIsAuthenticated(false);
    setPreview(null);
    setSplitResult(null);
    setOrderInput("");
  }, []);

  const handleUnauthorized = useCallback(() => {
    setAuthError("Invalid password. Please log in again.");
    sessionStorage.removeItem("admin_token");
    setIsAuthenticated(false);
  }, []);

  // --- Preview ---

  const handlePreview = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setPreviewError("");
      setPreview(null);
      setSplitResult(null);
      setSplitError("");

      const parsed = parseOrderInput(orderInput);
      if (!parsed.orderNumber && !parsed.orderId) {
        setPreviewError("Enter a valid order number or URL.");
        return;
      }

      setPreviewLoading(true);
      try {
        const res = await fetch("/api/orders/preview", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify(parsed),
        });

        if (res.status === 401) {
          handleUnauthorized();
          return;
        }

        const data = await res.json();
        if (!res.ok) {
          setPreviewError(data.error || "Failed to fetch order");
          return;
        }

        setPreview(data as PreviewData);
      } catch (err) {
        setPreviewError(
          err instanceof Error ? err.message : "Network error"
        );
      } finally {
        setPreviewLoading(false);
      }
    },
    [orderInput, getToken, handleUnauthorized]
  );

  // --- Split ---

  const handleSplit = useCallback(async () => {
    if (!preview) return;

    setSplitError("");
    setSplitResult(null);
    setSplitLoading(true);

    try {
      const res = await fetch("/api/orders/split", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ orderId: preview.order.id }),
      });

      if (res.status === 401) {
        handleUnauthorized();
        return;
      }

      const data = await res.json();
      if (!res.ok) {
        setSplitError(data.error || "Split failed");
        return;
      }

      setSplitResult(data as SplitResult);
    } catch (err) {
      setSplitError(
        err instanceof Error ? err.message : "Network error"
      );
    } finally {
      setSplitLoading(false);
    }
  }, [preview, getToken, handleUnauthorized]);

  // --- Reset ---

  const handleReset = useCallback(() => {
    setOrderInput("");
    setPreview(null);
    setSplitResult(null);
    setPreviewError("");
    setSplitError("");
  }, []);

  // --- Render: Login ---

  if (!isAuthenticated) {
    return (
      <div style={s.container}>
        <h1 style={s.title}>Order Splitter</h1>
        <form onSubmit={handleLogin} style={s.form}>
          <label style={s.label}>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={s.input}
              autoFocus
              required
            />
          </label>
          {authError && <p style={s.error}>{authError}</p>}
          <button type="submit" style={s.btn}>
            Log In
          </button>
        </form>
      </div>
    );
  }

  // --- Render: Main ---

  return (
    <div style={s.container}>
      <div style={s.header}>
        <h1 style={s.title}>Order Splitter</h1>
        <button onClick={handleLogout} style={s.link}>
          Log out
        </button>
      </div>

      {/* Order input */}
      {!splitResult && (
        <form onSubmit={handlePreview} style={s.form}>
          <label style={s.label}>
            Order number or Shopify admin URL
            <input
              type="text"
              value={orderInput}
              onChange={(e) => setOrderInput(e.target.value)}
              placeholder="#1042 or https://admin.shopify.com/.../orders/12345"
              style={s.input}
              autoFocus
              required
            />
          </label>
          {previewError && <p style={s.error}>{previewError}</p>}
          <button type="submit" disabled={previewLoading} style={s.btn}>
            {previewLoading ? "Loading..." : "Preview Order"}
          </button>
        </form>
      )}

      {/* Preview */}
      {preview && !splitResult && (
        <div>
          <h2 style={s.subtitle}>Order {preview.order.name}</h2>

          {preview.alreadyProcessed && (
            <div style={s.warning}>
              This order has already been processed (has split tag).
            </div>
          )}
          {!preview.splitNeeded && (
            <div style={s.warning}>
              No split needed — all items are in the same fulfillment
              group.
            </div>
          )}

          <div style={s.info}>
            <strong>Email:</strong> {preview.order.email ?? "N/A"}
          </div>
          {preview.order.shippingAddress && (
            <div style={s.info}>
              <strong>Ship to:</strong>{" "}
              {[
                preview.order.shippingAddress.firstName,
                preview.order.shippingAddress.lastName,
              ]
                .filter(Boolean)
                .join(" ")}
              {preview.order.shippingAddress.city &&
                `, ${preview.order.shippingAddress.city}`}
              {preview.order.shippingAddress.province &&
                `, ${preview.order.shippingAddress.province}`}
              {preview.order.shippingAddress.country &&
                `, ${preview.order.shippingAddress.country}`}
            </div>
          )}
          <div style={s.info}>
            <strong>Shipping:</strong> $
            {parseFloat(preview.order.totalShipping).toFixed(2)}{" "}
            {preview.order.currency}
          </div>
          {parseFloat(preview.order.totalDiscount) > 0 && (
            <div style={s.info}>
              <strong>Discount:</strong> $
              {parseFloat(preview.order.totalDiscount).toFixed(2)}{" "}
              {preview.order.currency}
            </div>
          )}

          <h3 style={s.groupTitle}>
            US Items ({preview.usItems.length})
          </h3>
          {preview.usItems.length === 0 ? (
            <p style={s.muted}>None</p>
          ) : (
            <ItemTable items={preview.usItems} />
          )}

          <h3 style={s.groupTitle}>
            Non-US Items ({preview.nonUsItems.length})
          </h3>
          {preview.nonUsItems.length === 0 ? (
            <p style={s.muted}>None</p>
          ) : (
            <ItemTable items={preview.nonUsItems} />
          )}

          <div style={s.actions}>
            <button
              onClick={handleSplit}
              disabled={splitLoading || !preview.splitNeeded}
              style={{
                ...s.btn,
                ...s.dangerBtn,
                opacity:
                  splitLoading || !preview.splitNeeded ? 0.5 : 1,
              }}
            >
              {splitLoading ? "Splitting..." : "Confirm & Split Order"}
            </button>
            <button onClick={handleReset} style={s.link}>
              Cancel
            </button>
          </div>
          {splitError && <p style={s.error}>{splitError}</p>}
        </div>
      )}

      {/* Result */}
      {splitResult && (
        <div>
          {splitResult.action === "split" && (
            <div style={s.success}>
              <h2 style={s.subtitle}>Split Successful</h2>
              <p>
                <strong>US Order:</strong> {splitResult.usOrderName}
              </p>
              <p>
                <strong>Non-US Order:</strong>{" "}
                {splitResult.nonUsOrderName}
              </p>
            </div>
          )}
          {splitResult.action === "skipped" && (
            <div style={s.warning}>
              <h2 style={s.subtitle}>Skipped</h2>
              <p>{splitResult.reason}</p>
            </div>
          )}
          {splitResult.action === "no-split-needed" && (
            <div style={s.warning}>
              <h2 style={s.subtitle}>No Split Needed</h2>
              <p>All items are in the same fulfillment group.</p>
            </div>
          )}
          <button onClick={handleReset} style={s.btn}>
            Split Another Order
          </button>
        </div>
      )}
    </div>
  );
}

// --- Item table ---

function ItemTable({ items }: { items: PreviewItem[] }) {
  return (
    <table style={s.table}>
      <thead>
        <tr>
          <th style={s.th}>Item</th>
          <th style={s.th}>Qty</th>
          <th style={s.th}>Unit Price</th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, i) => (
          <tr key={i}>
            <td style={s.td}>{item.title}</td>
            <td style={s.td}>{item.quantity}</td>
            <td style={s.td}>
              ${parseFloat(item.unitPrice).toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// --- Styles ---

const s: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 720,
    margin: "40px auto",
    padding: "0 20px",
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    color: "#1a1a1a",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
  },
  title: { fontSize: 24, fontWeight: 600, margin: 0 },
  subtitle: { fontSize: 18, fontWeight: 600, margin: "0 0 12px 0" },
  form: { marginBottom: 24 },
  label: { display: "block", fontSize: 14, fontWeight: 500, marginBottom: 16 },
  input: {
    display: "block",
    width: "100%",
    padding: "8px 12px",
    marginTop: 4,
    fontSize: 14,
    border: "1px solid #ccc",
    borderRadius: 4,
    boxSizing: "border-box" as const,
  },
  btn: {
    padding: "8px 20px",
    fontSize: 14,
    fontWeight: 500,
    color: "#fff",
    backgroundColor: "#333",
    border: "none",
    borderRadius: 4,
    cursor: "pointer",
  },
  dangerBtn: { backgroundColor: "#c0392b" },
  link: {
    padding: "8px 12px",
    fontSize: 14,
    color: "#555",
    background: "none",
    border: "none",
    cursor: "pointer",
    textDecoration: "underline",
  },
  error: { color: "#c0392b", fontSize: 14, margin: "8px 0" },
  warning: {
    padding: "12px 16px",
    marginBottom: 16,
    backgroundColor: "#fff3cd",
    border: "1px solid #ffc107",
    borderRadius: 4,
    fontSize: 14,
  },
  success: {
    padding: "12px 16px",
    marginBottom: 16,
    backgroundColor: "#d4edda",
    border: "1px solid #28a745",
    borderRadius: 4,
    fontSize: 14,
  },
  info: { fontSize: 14, marginBottom: 4 },
  groupTitle: {
    fontSize: 15,
    fontWeight: 600,
    marginTop: 20,
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: "1px solid #eee",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    marginBottom: 8,
    fontSize: 14,
  },
  th: {
    textAlign: "left" as const,
    padding: "6px 8px",
    borderBottom: "2px solid #ddd",
    fontWeight: 600,
  },
  td: { padding: "6px 8px", borderBottom: "1px solid #eee" },
  muted: { color: "#888", fontSize: 14 },
  actions: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginTop: 20,
  },
};
