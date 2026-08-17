// Server-only Binance C2P (P2P) API helpers. Uses Web Crypto HMAC-SHA256 so it
// runs inside the edge worker runtime.

const BASE = "https://api.binance.com";

async function sign(query: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(query));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type BinanceCreds = { apiKey: string; apiSecret: string };

async function signedRequest(
  creds: BinanceCreds,
  method: "GET" | "POST",
  path: string,
  params: Record<string, string | number> = {},
): Promise<{ ok: boolean; status: number; body: any }> {
  const query = new URLSearchParams({
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
    timestamp: String(Date.now()),
    recvWindow: "10000",
  }).toString();
  const signature = await sign(query, creds.apiSecret);
  const url = `${BASE}${path}?${query}&signature=${signature}`;

  const res = await fetch(url, {
    method,
    headers: {
      "X-MBX-APIKEY": creds.apiKey,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    /* keep raw text */
  }
  return { ok: res.ok, status: res.status, body };
}

/** Lightweight credential check. */
export async function testCredentials(creds: BinanceCreds) {
  const res = await signedRequest(creds, "GET", "/sapi/v1/account/status");
  if (!res.ok) {
    return {
      ok: false as const,
      message:
        typeof res.body === "object" && res.body?.msg
          ? `Binance rejected the keys [${res.status}]: ${res.body.msg}`
          : `Binance request failed [${res.status}]: ${String(res.body).slice(0, 300)}`,
    };
  }
  return { ok: true as const, message: "Binance API keys are valid and connected." };
}

export type NormalizedOrder = {
  order_id: string;
  buyer_username: string | null;
  buyer_real_name: string | null;
  status: "ongoing" | "paid" | "appeal" | "completed" | "cancelled";
  trade_type: string | null;
  fiat_amount: number;
  fiat_currency: string;
  asset: string;
  crypto_amount: number;
  unit_price: number | null;
  payment_method: string | null;
  order_created_at: string | null;
  raw: unknown;
};

// Binance C2C orderStatus codes.
function mapStatus(code: number): NormalizedOrder["status"] {
  switch (code) {
    case 1:
    case 2:
      return "ongoing";
    case 3:
    case 4:
      return "paid";
    case 5:
      return "completed";
    case 6:
      return "appeal";
    default:
      return "cancelled";
  }
}

/** Pulls recent P2P orders for the connected account. */
export async function fetchOrders(creds: BinanceCreds): Promise<
  { ok: true; orders: NormalizedOrder[] } | { ok: false; message: string }
> {
  const res = await signedRequest(creds, "GET", "/sapi/v1/c2c/orderMatch/listUserOrderHistory", {
    page: 1,
    rows: 50,
  });
  if (!res.ok || (typeof res.body === "object" && res.body?.code && res.body.code !== "000000")) {
    const msg =
      typeof res.body === "object"
        ? res.body?.msg || res.body?.message || JSON.stringify(res.body).slice(0, 300)
        : String(res.body).slice(0, 300);
    return { ok: false, message: `Binance order fetch failed [${res.status}]: ${msg}` };
  }

  const list: any[] = res.body?.data ?? [];
  const orders = list.map((o) => {
    const counterparty = o.counterPartNickName ?? o.buyerNickname ?? o.counterPartyNickName ?? null;
    return {
      order_id: String(o.orderNumber ?? o.orderId ?? ""),
      buyer_username: counterparty,
      buyer_real_name: o.counterPartRealName ?? o.buyerName ?? null,
      status: mapStatus(Number(o.orderStatus)),
      trade_type: o.tradeType ?? null,
      fiat_amount: Number(o.totalPrice ?? o.amount ?? 0),
      fiat_currency: o.fiat ?? o.fiatUnit ?? "USD",
      asset: o.asset ?? "USDT",
      crypto_amount: Number(o.amount ?? 0),
      unit_price: o.unitPrice != null ? Number(o.unitPrice) : null,
      payment_method: o.payMethodName ?? o.payType ?? null,
      order_created_at: o.createTime ? new Date(Number(o.createTime)).toISOString() : null,
      raw: o,
    } satisfies NormalizedOrder;
  });
  return { ok: true, orders: orders.filter((o) => o.order_id) };
}

/** Releases the crypto for a paid P2P order. */
export async function releaseOrder(creds: BinanceCreds, orderNumber: string) {
  const res = await signedRequest(creds, "POST", "/sapi/v1/c2c/orderMatch/releaseCoin", {
    orderNumber,
  });
  const okBody = typeof res.body === "object" ? res.body?.code === "000000" || res.body?.success === true : false;
  if (!res.ok || !okBody) {
    const msg =
      typeof res.body === "object"
        ? res.body?.msg || res.body?.message || JSON.stringify(res.body).slice(0, 300)
        : String(res.body).slice(0, 300);
    return { ok: false as const, message: `Release failed [${res.status}]: ${msg}` };
  }
  return { ok: true as const, message: `USDT released for order ${orderNumber}.` };
}
