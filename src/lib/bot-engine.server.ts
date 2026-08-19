// Server-only automation engine: order syncing, SMS parsing/matching and
// release execution. Runs entirely in Lovable Cloud, independent of the user's
// device, driven either by the scheduled poller or the SMS webhook.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchOrders, releaseOrder, type BinanceCreds } from "./binance.server";
import { sendTelegram } from "./telegram.server";

export type NotificationKind =
  | "new_order"
  | "paid"
  | "appeal"
  | "release"
  | "sms"
  | "ambiguity";

export type BotSettings = {
  id: string;
  user_id: string;
  country: string;
  bot_running: boolean;
  auto_release: boolean;
  binance_api_key: string | null;
  binance_api_secret: string | null;
  telegram_bot_token: string | null;
  telegram_chat_id: string | null;
  webhook_token: string;
  poll_interval_seconds?: number | null;
  notify_new_order?: boolean | null;
  notify_paid?: boolean | null;
  notify_appeal?: boolean | null;
  notify_release?: boolean | null;
  notify_sms?: boolean | null;
  notify_ambiguity?: boolean | null;
};

const NOTIFY_FLAG: Record<NotificationKind, keyof BotSettings> = {
  new_order: "notify_new_order",
  paid: "notify_paid",
  appeal: "notify_appeal",
  release: "notify_release",
  sms: "notify_sms",
  ambiguity: "notify_ambiguity",
};

/**
 * Telegram dispatch gated by the per-event toggles. Muting a category never
 * changes background automation — it only suppresses the push message.
 */
export async function notify(settings: BotSettings, kind: NotificationKind, text: string) {
  const enabled = settings[NOTIFY_FLAG[kind]];
  if (enabled === false) return { ok: false, message: `Notification "${kind}" is muted.` };
  return sendTelegram(settings.telegram_bot_token, settings.telegram_chat_id, text);
}

export async function logEvent(
  userId: string,
  level: "info" | "success" | "warning" | "error",
  eventType: string,
  message: string,
  details?: unknown,
) {
  await supabaseAdmin.from("system_logs").insert({
    user_id: userId,
    level,
    event_type: eventType,
    message,
    details: (details ?? null) as never,
  });
}

export function creds(settings: BotSettings): BinanceCreds | null {
  if (!settings.binance_api_key || !settings.binance_api_secret) return null;
  return { apiKey: settings.binance_api_key, apiSecret: settings.binance_api_secret };
}

/** Pull orders from Binance and upsert them, alerting on newly seen orders. */
export async function syncOrdersForUser(settings: BotSettings) {
  const c = creds(settings);
  if (!c) {
    await logEvent(settings.user_id, "warning", "binance_sync", "Binance API keys are not configured.");
    return { ok: false, message: "Binance API keys are not configured." };
  }

  const result = await fetchOrders(c);
  if (!result.ok) {
    await supabaseAdmin
      .from("bot_settings")
      .update({ last_poll_at: new Date().toISOString(), last_poll_status: "error" })
      .eq("user_id", settings.user_id);
    await logEvent(settings.user_id, "error", "binance_sync", result.message);
    return { ok: false, message: result.message };
  }

  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("order_id, status")
    .eq("user_id", settings.user_id);
  const known = new Map((existing ?? []).map((o) => [o.order_id, o.status]));

  for (const order of result.orders) {
    const prev = known.get(order.order_id);
    await supabaseAdmin.from("orders").upsert(
      {
        user_id: settings.user_id,
        order_id: order.order_id,
        buyer_username: order.buyer_username,
        buyer_real_name: order.buyer_real_name,
        status: order.status,
        trade_type: order.trade_type,
        fiat_amount: order.fiat_amount,
        fiat_currency: order.fiat_currency,
        asset: order.asset,
        crypto_amount: order.crypto_amount,
        unit_price: order.unit_price,
        payment_method: order.payment_method,
        order_created_at: order.order_created_at,
        raw: order.raw as never,
        ...(order.status === "completed" ? { released: true } : {}),
      },
      { onConflict: "user_id,order_id" },
    );

    if (prev === undefined) {
      await logEvent(
        settings.user_id,
        "info",
        "new_order",
        `New ${order.status} order ${order.order_id} from ${order.buyer_username ?? "unknown buyer"} for ${order.fiat_amount} ${order.fiat_currency}`,
      );
      await notifyNewOrder(settings, order.order_id, order.buyer_username, order.fiat_amount, order.fiat_currency, order.status);
      // Hand the chat message to the browser agent — Binance has no public API
      // for posting into the P2P chat.
      if (order.status === "ongoing" || order.status === "paid") {
        const { queueBankDetails } = await import("./automation.server");
        await queueBankDetails(settings, order.order_id, order.buyer_username);
      }

    } else if (prev !== order.status) {
      await logEvent(
        settings.user_id,
        "info",
        "order_status",
        `Order ${order.order_id} moved from ${prev} to ${order.status}`,
      );
      if (order.status === "appeal") {
        await notify(
          settings,
          "appeal",
          `⚠️ <b>Appeal opened</b>\nOrder: <code>${order.order_id}</code>\nBuyer: ${order.buyer_username ?? "-"}\nHandle this manually in Binance.`,
        );
      } else if (order.status === "paid") {
        await notify(
          settings,
          "paid",
          `💵 <b>Buyer marked as PAID</b>\nOrder: <code>${order.order_id}</code>\nBuyer: ${order.buyer_username ?? "-"}\nAmount: ${order.fiat_amount} ${order.fiat_currency}\nWaiting for payment SMS verification.`,
        );
      } else if (order.status === "completed") {
        await notify(
          settings,
          "release",
          `🏁 <b>Order completed</b>\nOrder: <code>${order.order_id}</code>\nBuyer: ${order.buyer_username ?? "-"}`,
        );
      }
    }
  }

  await supabaseAdmin
    .from("bot_settings")
    .update({ last_poll_at: new Date().toISOString(), last_poll_status: "ok" })
    .eq("user_id", settings.user_id);

  return { ok: true, message: `Synced ${result.orders.length} orders.`, count: result.orders.length };
}

async function notifyNewOrder(
  settings: BotSettings,
  orderId: string,
  buyer: string | null,
  amount: number,
  currency: string,
  status: string,
) {
  const { data: methods } = await supabaseAdmin
    .from("payment_methods")
    .select("method_type, bank_name, account_name, account_number, iban")
    .eq("user_id", settings.user_id)
    .eq("country", settings.country)
    .eq("is_active", true);

  const details = (methods ?? [])
    .map(
      (m) =>
        `• <b>${m.method_type}</b> — ${m.bank_name}\n   ${m.account_name}\n   ${m.account_number ?? m.iban ?? ""}`,
    )
    .join("\n");

  await notify(
    settings,
    "new_order",
    `🆕 <b>New ${status === "ongoing" ? "pending" : status} order</b>\nOrder: <code>${orderId}</code>\nBuyer: ${buyer ?? "-"}\nAmount: ${amount} ${currency}\n\n<b>Send these payment details:</b>\n${details || "No payment methods configured."}`,
  );
}

/* ------------------------------ SMS matching ------------------------------ */

export type ParsedSms = {
  amount: number | null;
  reference: string | null;
  payerName: string | null;
};

export function parseSms(text: string): ParsedSms {
  const clean = text.replace(/\s+/g, " ");
  const amountMatch =
    clean.match(/(?:rs\.?|pkr|inr|usd|aed|ngn|eur|gbp|bdt|₨|₹|\$)\s*([\d,]+(?:\.\d{1,2})?)/i) ??
    clean.match(/([\d,]+\.\d{2})/);
  const refMatch = clean.match(/(?:tid|trx|txn|ref(?:erence)?(?:\s*(?:no|id|#))?)[:\s#]*([A-Za-z0-9-]{4,})/i);
  const payerMatch = clean.match(/(?:from|by|sender|received from)[:\s]+([A-Za-z][A-Za-z .'-]{2,40})/i);

  return {
    amount: amountMatch ? Number(amountMatch[1]!.replace(/,/g, "")) : null,
    reference: refMatch ? refMatch[1]! : null,
    payerName: payerMatch ? payerMatch[1]!.trim() : null,
  };
}

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z ]/g, "").replace(/\s+/g, " ").trim();
}

export function nameSimilarity(a: string, b: string): number {
  const at = new Set(normalizeName(a).split(" ").filter(Boolean));
  const bt = new Set(normalizeName(b).split(" ").filter(Boolean));
  if (!at.size || !bt.size) return 0;
  let hits = 0;
  at.forEach((t) => {
    if (bt.has(t)) hits += 1;
  });
  return hits / Math.min(at.size, bt.size);
}

const MATCH_WINDOW_HOURS = 24;

type Candidate = {
  id: string;
  order_id: string;
  status: string;
  buyer_username: string | null;
  buyer_real_name: string | null;
  fiat_amount: number | string;
  fiat_currency: string;
  order_created_at: string | null;
  created_at: string;
};

type Scored = { order: Candidate; score: number; reasons: string[] };

/**
 * Multi-factor confidence score for one candidate order.
 * Exact fiat amount (incl. decimals) is mandatory; a transaction reference,
 * a valid time window and a fuzzy name/account match add confidence.
 */
function scoreCandidate(
  order: Candidate,
  ctx: { amount: number; reference: string | null; payerName: string | null; rawText: string },
): Scored {
  const reasons: string[] = ["exact amount"];
  let score = 0.5;

  const placed = new Date(order.order_created_at ?? order.created_at).getTime();
  const ageHours = (Date.now() - placed) / 3_600_000;
  if (ageHours <= MATCH_WINDOW_HOURS) {
    score += 0.15;
    reasons.push("within time window");
  } else {
    score -= 0.3;
    reasons.push("outside time window");
  }

  const haystack = ctx.rawText.toLowerCase();
  if (ctx.reference && haystack.includes(ctx.reference.toLowerCase())) {
    score += 0.1;
    reasons.push("reference present");
  }

  const nameTarget = order.buyer_real_name ?? order.buyer_username ?? "";
  if (ctx.payerName && nameTarget) {
    const sim = nameSimilarity(ctx.payerName, nameTarget);
    if (sim >= 0.8) {
      score += 0.35;
      reasons.push("name match");
    } else if (sim >= 0.5) {
      score += 0.2;
      reasons.push("partial name match");
    } else {
      score -= 0.2;
      reasons.push("name mismatch");
    }
  }

  return { order, score: Math.max(0, Math.min(1, score)), reasons };
}

/**
 * Matches an incoming payment SMS against pending Binance orders. Requires a
 * single high-confidence candidate: if two or more simultaneous orders remain
 * plausible, automation is paused and an urgent Telegram warning is sent.
 */
export async function processIncomingSms(
  settings: BotSettings,
  input: { rawText: string; sender?: string | null; amount?: number | null; reference?: string | null; payerName?: string | null },
) {
  const parsed = parseSms(input.rawText);
  const amount = input.amount ?? parsed.amount;
  const reference = input.reference ?? parsed.reference;
  const payerName = input.payerName ?? parsed.payerName;

  await logEvent(settings.user_id, "info", "webhook_hit", `Payment SMS received${amount ? ` for ${amount}` : ""}${reference ? ` (ref ${reference})` : ""}`);
  await notify(
    settings,
    "sms",
    `📩 <b>Payment SMS received</b>\nAmount: ${amount ?? "?"}\nFrom: ${payerName ?? input.sender ?? "-"}${reference ? `\nRef: <code>${reference}</code>` : ""}`,
  );

  const { data: candidates } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("user_id", settings.user_id)
    .in("status", ["ongoing", "paid"])
    .eq("released", false);

  const pool = ((candidates ?? []) as unknown as Candidate[]).filter(
    (o) => amount != null && Math.abs(Number(o.fiat_amount) - amount) < 0.01,
  );

  const scored: Scored[] = amount == null
    ? []
    : pool
        .map((o) => scoreCandidate(o, { amount, reference, payerName, rawText: input.rawText }))
        .sort((a, b) => b.score - a.score);

  const best = scored[0];
  const runnerUp = scored[1];
  // 100% confidence gate: the top candidate must be strong AND clearly ahead.
  const confident =
    Boolean(best) && best!.score >= 0.85 && (!runnerUp || best!.score - runnerUp.score >= 0.2);
  const ambiguous = scored.length > 1 && !confident;

  let matched: Candidate | null = confident ? best!.order : null;
  let matchStatus = "unmatched";
  let actionTaken: string | null = null;

  if (ambiguous) {
    matchStatus = "ambiguous";
    actionTaken = "paused — manual intervention required";
    const list = scored
      .slice(0, 5)
      .map((s) => `• <code>${s.order.order_id}</code> ${s.order.buyer_username ?? "-"} (${Math.round(s.score * 100)}%)`)
      .join("\n");
    await supabaseAdmin
      .from("orders")
      .update({ match_ambiguous: true })
      .in("id", scored.map((s) => s.order.id));
    await logEvent(
      settings.user_id,
      "warning",
      "sms_ambiguous",
      `Ambiguous payment of ${amount}: ${scored.length} possible orders — automation paused.`,
      { candidates: scored.map((s) => ({ order_id: s.order.order_id, score: s.score, reasons: s.reasons })) },
    );
    await notify(
      settings,
      "ambiguity",
      `🚨 <b>MANUAL INTERVENTION NEEDED</b>\nA payment of ${amount} could not be matched to one specific order with full confidence. No USDT was released.\n\nPossible orders:\n${list}\n\nPlease verify and act manually in Binance.`,
    );
  } else if (matched) {
    matchStatus = "matched";
    await supabaseAdmin
      .from("orders")
      .update({
        payment_verified: true,
        match_ambiguous: false,
        status: matched.status === "ongoing" ? "paid" : matched.status,
      })
      .eq("id", matched.id);

    await logEvent(
      settings.user_id,
      "success",
      "sms_matched",
      `Payment of ${amount} matched to order ${matched.order_id} (buyer ${matched.buyer_username ?? "-"}) — confidence ${Math.round(best!.score * 100)}% [${best!.reasons.join(", ")}]`,
    );

    if (settings.auto_release) {
      const c = creds(settings);
      if (!c) {
        actionTaken = "auto-release skipped: Binance keys missing";
        await logEvent(settings.user_id, "error", "release", actionTaken);
      } else {
        const rel = await releaseOrder(c, matched.order_id);
        if (rel.ok) {
          matchStatus = "released";
          actionTaken = "auto-released";
          await supabaseAdmin
            .from("orders")
            .update({ released: true, released_at: new Date().toISOString(), status: "completed" })
            .eq("id", matched.id);
          await logEvent(settings.user_id, "success", "release", `USDT auto-released for order ${matched.order_id}`);
          await notify(
            settings,
            "release",
            `✅ <b>USDT released automatically</b>\nOrder: <code>${matched.order_id}</code>\nBuyer: ${matched.buyer_username ?? "-"}\nAmount: ${matched.fiat_amount} ${matched.fiat_currency}`,
          );
        } else {
          // API release is frequently restricted — fall back to the browser agent.
          const { enqueueTask } = await import("./automation.server");
          await enqueueTask(settings, "release_usdt", matched.order_id, matched.buyer_username, {
            api_error: rel.message,
          });
          matchStatus = "verified";
          actionTaken = "queued browser release";
          await logEvent(
            settings.user_id,
            "warning",
            "release",
            `API release unavailable (${rel.message}) — queued browser automation for order ${matched.order_id}.`,
          );
          await notify(
            settings,
            "release",
            `⚠️ <b>API release blocked — using browser agent</b>\nOrder: <code>${matched.order_id}</code>\n${rel.message}\nIf the agent is offline, release manually.`,
          );
        }
      }
    } else {
      actionTaken = "manual release required";
      await notify(
        settings,
        "release",
        `💰 <b>Payment confirmed for Order ${matched.order_id}. Please release USDT manually.</b>\nBuyer: ${matched.buyer_username ?? "-"}\nAmount: ${matched.fiat_amount} ${matched.fiat_currency}`,
      );

      await logEvent(settings.user_id, "warning", "manual_release", `Auto-release is OFF — manual release requested for order ${matched.order_id}`);
    }
  } else {
    await logEvent(
      settings.user_id,
      "warning",
      "sms_unmatched",
      `No pending order matched this payment${amount ? ` of ${amount}` : ""}`,
    );
    await notify(
      settings,
      "ambiguity",
      `⚠️ <b>Unmatched payment SMS</b>\nAmount: ${amount ?? "?"}\nFrom: ${payerName ?? input.sender ?? "-"}\nNo matching pending order was found.`,
    );
  }

  const { data: inserted } = await supabaseAdmin
    .from("sms_logs")
    .insert({
      user_id: settings.user_id,
      raw_text: input.rawText,
      sender: input.sender ?? null,
      payer_name: payerName,
      reference_id: reference,
      amount,
      match_status: matchStatus,
      matched_order_id: matched?.order_id ?? null,
      matched_buyer_username: matched?.buyer_username ?? null,
      action_taken: actionTaken,
    })
    .select("id")
    .single();

  return {
    ok: true,
    matched: Boolean(matched),
    order_id: matched?.order_id ?? null,
    sms_log_id: inserted?.id ?? null,
    action: actionTaken,
  };
}

/** Manual release triggered from the dashboard. */
export async function manualRelease(settings: BotSettings, orderId: string) {
  const c = creds(settings);
  if (!c) return { ok: false, message: "Binance API keys are not configured." };
  const rel = await releaseOrder(c, orderId);
  if (rel.ok) {
    await supabaseAdmin
      .from("orders")
      .update({ released: true, released_at: new Date().toISOString(), status: "completed" })
      .eq("user_id", settings.user_id)
      .eq("order_id", orderId);
    await logEvent(settings.user_id, "success", "release", `USDT manually released for order ${orderId}`);
  } else {
    await logEvent(settings.user_id, "error", "release", rel.message);
  }
  return rel;
}
