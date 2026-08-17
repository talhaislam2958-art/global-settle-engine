// Server-only implementation behind the dashboard's server functions.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { testCredentials } from "./binance.server";
import { sendTelegram } from "./telegram.server";
import {
  creds,
  logEvent,
  manualRelease,
  processIncomingSms,
  syncOrdersForUser,
  type BotSettings,
} from "./bot-engine.server";

export async function ensureSettings(userId: string): Promise<BotSettings> {
  const { data } = await supabaseAdmin.from("bot_settings").select("*").eq("user_id", userId).maybeSingle();
  if (data) return data as BotSettings;
  const { data: created, error } = await supabaseAdmin
    .from("bot_settings")
    .insert({ user_id: userId })
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return created as BotSettings;
}

export async function loadState(userId: string) {
  const settings = await ensureSettings(userId);
  const [methods, orders, sms, logs] = await Promise.all([
    supabaseAdmin.from("payment_methods").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabaseAdmin.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("sms_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
    supabaseAdmin.from("system_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
  ]);

  const s = settings as BotSettings & { last_poll_at?: string | null; last_poll_status?: string | null };
  return {
    settings: {
      country: s.country,
      bot_running: s.bot_running,
      auto_release: s.auto_release,
      binance_connected: Boolean(s.binance_api_key && s.binance_api_secret),
      binance_api_key_masked: s.binance_api_key ? `${s.binance_api_key.slice(0, 6)}••••${s.binance_api_key.slice(-4)}` : null,
      telegram_connected: Boolean(s.telegram_bot_token && s.telegram_chat_id),
      telegram_chat_id: s.telegram_chat_id,
      webhook_token: s.webhook_token,
      last_poll_at: s.last_poll_at ?? null,
      last_poll_status: s.last_poll_status ?? null,
    },
    payment_methods: methods.data ?? [],
    orders: orders.data ?? [],
    sms_logs: sms.data ?? [],
    system_logs: logs.data ?? [],
  };
}

export async function updateSettings(userId: string, patch: Record<string, unknown>) {
  await ensureSettings(userId);
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (typeof v === "string" && v.trim() === "") continue; // never blank out saved secrets accidentally
    clean[k] = v;
  }
  const { error } = await supabaseAdmin.from("bot_settings").update(clean as never).eq("user_id", userId);
  if (error) throw new Error(error.message);

  if ("bot_running" in clean) {
    await logEvent(
      userId,
      clean["bot_running"] ? "success" : "warning",
      "bot_switch",
      clean["bot_running"] ? "Automation engine STARTED — running 24/7 in the cloud." : "Automation engine STOPPED.",
    );
  }
  if ("auto_release" in clean) {
    await logEvent(userId, "info", "auto_release", `Auto-release switched ${clean["auto_release"] ? "ON" : "OFF"}.`);
  }
  return { ok: true };
}

export async function testKeys(userId: string) {
  const settings = await ensureSettings(userId);
  const c = creds(settings);
  if (!c) return { ok: false, message: "Save your Binance API key and secret first." };
  const result = await testCredentials(c);
  await logEvent(userId, result.ok ? "success" : "error", "binance_test", result.message);
  return result;
}

export async function testTelegramAlert(userId: string) {
  const settings = await ensureSettings(userId);
  const result = await sendTelegram(
    settings.telegram_bot_token,
    settings.telegram_chat_id,
    "🤖 <b>Test alert</b>\nYour P2P automation bot is connected to Telegram.",
  );
  await logEvent(userId, result.ok ? "success" : "error", "telegram_test", result.message);
  return result;
}

export async function runSync(userId: string) {
  const settings = await ensureSettings(userId);
  return syncOrdersForUser(settings);
}

export async function runManualRelease(userId: string, orderId: string) {
  const settings = await ensureSettings(userId);
  return manualRelease(settings, orderId);
}

export async function runSmsTest(userId: string, text: string) {
  const settings = await ensureSettings(userId);
  return processIncomingSms(settings, { rawText: text, sender: "dashboard-test" });
}

export async function upsertPaymentMethod(userId: string, input: Record<string, unknown>) {
  const payload = { ...input, user_id: userId };
  const { error } = await supabaseAdmin.from("payment_methods").upsert(payload as never);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function removePaymentMethod(userId: string, id: string) {
  const { error } = await supabaseAdmin.from("payment_methods").delete().eq("user_id", userId).eq("id", id);
  if (error) throw new Error(error.message);
  return { ok: true };
}
