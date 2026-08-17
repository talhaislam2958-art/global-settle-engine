// Server-only Binance C2P (P2P) API helpers. Uses Web Crypto HMAC-SHA256 so it
// runs inside the edge worker runtime.
//
// IMPORTANT (403 fix): api.binance.com sits behind CloudFront, which rejects
// requests that look like anonymous bots — no User-Agent, no Accept header, or
// a Content-Type on a GET. Edge-worker fetch sends exactly that shape, which is
// why signed calls came back as an HTML "403 ERROR / The request could not be
// satisfied" page instead of JSON. We now send browser-like headers, keep GETs
// header-clean, and fail over across Binance's mirror hosts when an edge
// location blocks us.

const HOSTS = [
  "https://api.binance.com",
  "https://api-gcp.binance.com",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api4.binance.com",
];

const BROWSER_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Referer: "https://www.binance.com/",
  Origin: "https://www.binance.com",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
};

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

function isEdgeBlock(status: number, text: string) {
  // CloudFront / WAF blocks return HTML, never Binance JSON error codes.
  return (
    (status === 403 || status === 401 || status === 405 || status >= 500) &&
    /<html|The request could not be satisfied|Request blocked|cloudfront/i.test(text)
  );
}

async function signedRequest(
  creds: BinanceCreds,
  method: "GET" | "POST",
  path: string,
  params: Record<string, string | number> = {},
): Promise<{ ok: boolean; status: number; body: any; blocked?: boolean }> {
  let last: { ok: boolean; status: number; body: any; blocked?: boolean } = {
    ok: false,
    status: 0,
    body: "No response from Binance.",
    blocked: true,
  };

  for (const host of HOSTS) {
    const query = new URLSearchParams({
      ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
      timestamp: String(Date.now()),
      recvWindow: "10000",
    }).toString();
    const signature = await sign(query, creds.apiSecret);
    const url = `${host}${path}?${query}&signature=${signature}`;

    const headers: Record<string, string> = {
      ...BROWSER_HEADERS,
      "X-MBX-APIKEY": creds.apiKey,
    };
    // Never send a body/Content-Type: everything is signed in the query string.
    let res: Response;
    try {
      res = await fetch(url, { method, headers, redirect: "follow" });
    } catch (error) {
      last = { ok: false, status: 0, body: `Network error contacting ${host}: ${String(error)}`, blocked: true };
      continue;
    }

    const text = await res.text();
    if (isEdgeBlock(res.status, text)) {
      last = {
        ok: false,
        status: res.status,
        body: `Binance edge (${new URL(host).host}) blocked the request.`,
        blocked: true,
      };
      continue; // try the next mirror host
    }

    let body: any = text;
    try {
      body = JSON.parse(text);
    } catch {
      /* keep raw text */
    }
    return { ok: res.ok, status: res.status, body };
  }

  return last;
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
