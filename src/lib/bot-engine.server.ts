// Server-only automation engine: order syncing, SMS parsing/matching and
// release execution. Runs entirely in Lovable Cloud, independent of the user's
// device, driven either by the scheduled poller or the SMS webhook.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { fetchOrders, releaseOrder, type BinanceCreds } from "./binance.server";
import { sendTelegram } from "./telegram.server";

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
};

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
        await sendTelegram(
          settings.telegram_bot_token,
          settings.telegram_chat_id,
          `⚠️ <b>Appeal opened</b>\nOrder: <code>${order.order_id}</code>\nBuyer: ${order.buyer_username ?? "-"}\nHandle this manually in Binance.`,
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

  await sendTelegram(
    settings.telegram_bot_token,
    settings.telegram_chat_id,
    `🆕 <b>New ${status} order</b>\nOrder: <code>${orderId}</code>\nBuyer: ${buyer ?? "-"}\nAmount: ${amount} ${currency}\n\n<b>Send these payment details:</b>\n${details || "No payment methods configured."}`,
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

/**
 * Matches an incoming payment SMS against pending Binance orders on exact fiat
 * amount, then disambiguates simultaneous orders using the buyer's legal name.
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

  const { data: candidates } = await supabaseAdmin
    .from("orders")
    .select("*")
    .eq("user_id", settings.user_id)
    .in("status", ["ongoing", "paid"])
    .eq("released", false);

  let matched: (typeof candidates extends (infer T)[] | null ? T : never) | null = null;
  const pool = (candidates ?? []).filter((o) => amount != null && Math.abs(Number(o.fiat_amount) - amount) < 0.01);

  if (pool.length === 1) {
    matched = pool[0]!;
  } else if (pool.length > 1 && payerName) {
    const scored = pool
      .map((o) => ({ o, score: nameSimilarity(payerName, o.buyer_real_name ?? o.buyer_username ?? "") }))
      .sort((a, b) => b.score - a.score);
    if (scored[0] && scored[0].score >= 0.5 && (!scored[1] || scored[1].score < scored[0].score)) {
      matched = scored[0].o;
    }
  }

  let matchStatus = "unmatched";
  let actionTaken: string | null = null;

  if (matched) {
    matchStatus = "matched";
    await supabaseAdmin
      .from("orders")
      .update({ payment_verified: true, status: matched.status === "ongoing" ? "paid" : matched.status })
      .eq("id", matched.id);

    await logEvent(
      settings.user_id,
      "success",
      "sms_matched",
      `Payment of ${amount} matched to order ${matched.order_id} (buyer ${matched.buyer_username ?? "-"})`,
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
          await sendTelegram(
            settings.telegram_bot_token,
            settings.telegram_chat_id,
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
          await sendTelegram(
            settings.telegram_bot_token,
            settings.telegram_chat_id,
            `⚠️ <b>API release blocked — using browser agent</b>\nOrder: <code>${matched.order_id}</code>\n${rel.message}\nIf the agent is offline, release manually.`,
          );
        }
      }
    } else {
      actionTaken = "manual release required";
      await sendTelegram(
        settings.telegram_bot_token,
        settings.telegram_chat_id,
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
    await sendTelegram(
      settings.telegram_bot_token,
      settings.telegram_chat_id,
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
