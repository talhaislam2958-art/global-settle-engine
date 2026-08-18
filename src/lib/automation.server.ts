// Server-only browser-automation queue.
//
// The edge runtime cannot run a headless browser (no Chromium, no child
// processes), so execution actions that Binance does not expose over the public
// API — posting bank details into the P2P chat and releasing USDT — are queued
// here as tasks. A lightweight Playwright agent (public/agent/p2p-agent.mjs)
// runs on any always-on machine or VPS, authenticates with the account's agent
// token, claims tasks, performs them in a logged-in Binance session and reports
// results back. Reading/monitoring stays on the Binance API.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logEvent, type BotSettings } from "./bot-engine.server";

export type AutomationTaskType = "send_bank_details" | "release_usdt";

export const AGENT_ONLINE_WINDOW_MS = 3 * 60 * 1000;

export function agentOnline(lastSeen: string | null | undefined) {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < AGENT_ONLINE_WINDOW_MS;
}

/** Formats the merchant's active payment methods for the P2P chat. */
export async function buildBankDetailsMessage(settings: BotSettings) {
  const { data: methods } = await supabaseAdmin
    .from("payment_methods")
    .select("method_type, bank_name, account_name, account_number, iban, notes")
    .eq("user_id", settings.user_id)
    .eq("country", settings.country)
    .eq("is_active", true);

  if (!methods || methods.length === 0) return null;

  return methods
    .map((m) => {
      const lines = [
        `${m.method_type} - ${m.bank_name}`,
        `Account name: ${m.account_name}`,
        m.account_number ? `Account number: ${m.account_number}` : null,
        m.iban ? `IBAN: ${m.iban}` : null,
        m.notes ? m.notes : null,
      ].filter(Boolean);
      return lines.join("\n");
    })
    .join("\n\n");
}

export async function enqueueTask(
  settings: BotSettings,
  taskType: AutomationTaskType,
  orderId: string,
  buyerUsername: string | null,
  payload: Record<string, unknown> = {},
) {
  // Avoid duplicating an identical pending/claimed task for the same order.
  const { data: existing } = await supabaseAdmin
    .from("automation_tasks")
    .select("id")
    .eq("user_id", settings.user_id)
    .eq("order_id", orderId)
    .eq("task_type", taskType)
    .in("status", ["pending", "claimed"])
    .maybeSingle();
  if (existing) return { ok: true, queued: false, id: existing.id };

  const { data, error } = await supabaseAdmin
    .from("automation_tasks")
    .insert({
      user_id: settings.user_id,
      task_type: taskType,
      order_id: orderId,
      buyer_username: buyerUsername,
      payload: payload as never,
    })
    .select("id")
    .single();
  if (error) {
    await logEvent(settings.user_id, "error", "automation_queue", `Could not queue ${taskType}: ${error.message}`);
    return { ok: false, queued: false, id: null };
  }

  await logEvent(
    settings.user_id,
    "info",
    "automation_queue",
    taskType === "send_bank_details"
      ? `Queued bank-details chat message for order ${orderId} (browser automation).`
      : `Queued browser release of USDT for order ${orderId}.`,
  );
  return { ok: true, queued: true, id: data.id };
}

/** Queues the bank details the instant an order is detected. */
export async function queueBankDetails(settings: BotSettings, orderId: string, buyer: string | null) {
  const message = await buildBankDetailsMessage(settings);
  if (!message) {
    await logEvent(
      settings.user_id,
      "warning",
      "automation_queue",
      `No active payment methods for ${settings.country} — nothing to send for order ${orderId}.`,
    );
    return { ok: false, queued: false };
  }
  return enqueueTask(settings, "send_bank_details", orderId, buyer, { message });
}

/* --------------------------- Agent-facing helpers -------------------------- */

export async function settingsByAgentToken(token: string) {
  const { data } = await supabaseAdmin
    .from("bot_settings")
    .select("*")
    .eq("agent_token", token)
    .maybeSingle();
  return data as (BotSettings & { agent_version: string | null }) | null;
}

export async function touchAgent(userId: string, version?: string | null) {
  await supabaseAdmin
    .from("bot_settings")
    .update({ agent_last_seen_at: new Date().toISOString(), ...(version ? { agent_version: version } : {}) })
    .eq("user_id", userId);
}

export async function claimTasks(settings: BotSettings, limit = 5) {
  const { data: pending } = await supabaseAdmin
    .from("automation_tasks")
    .select("*")
    .eq("user_id", settings.user_id)
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);

  const claimed: unknown[] = [];
  for (const task of pending ?? []) {
    const { data } = await supabaseAdmin
      .from("automation_tasks")
      .update({ status: "claimed", claimed_at: new Date().toISOString(), attempts: task.attempts + 1 })
      .eq("id", task.id)
      .eq("status", "pending")
      .select("id, task_type, order_id, buyer_username, payload, attempts")
      .maybeSingle();
    if (data) claimed.push(data);
  }
  return claimed;
}

export async function completeTask(
  settings: BotSettings,
  taskId: string,
  ok: boolean,
  result: string,
) {
  const { data: task } = await supabaseAdmin
    .from("automation_tasks")
    .update({
      status: ok ? "done" : "failed",
      result: result.slice(0, 1000),
      finished_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("user_id", settings.user_id)
    .select("task_type, order_id")
    .maybeSingle();

  if (!task) return { ok: false, message: "Task not found." };

  await logEvent(
    settings.user_id,
    ok ? "success" : "error",
    task.task_type === "send_bank_details" ? "automation_chat" : "automation_release",
    `${task.task_type === "send_bank_details" ? "Bank details chat" : "Browser USDT release"} for order ${task.order_id}: ${result.slice(0, 300)}`,
  );

  if (ok && task.task_type === "release_usdt") {
    await supabaseAdmin
      .from("orders")
      .update({ released: true, released_at: new Date().toISOString(), status: "completed" })
      .eq("user_id", settings.user_id)
      .eq("order_id", task.order_id);
  }
  return { ok: true };
}
