import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const settingsSchema = z.object({
  country: z.string().min(2).max(10).optional(),
  bot_running: z.boolean().optional(),
  auto_release: z.boolean().optional(),
  binance_api_key: z.string().max(500).nullable().optional(),
  binance_api_secret: z.string().max(500).nullable().optional(),
  telegram_bot_token: z.string().max(500).nullable().optional(),
  telegram_chat_id: z.string().max(100).nullable().optional(),
  poll_interval_seconds: z.number().int().min(2).max(300).optional(),
  notify_new_order: z.boolean().optional(),
  notify_paid: z.boolean().optional(),
  notify_appeal: z.boolean().optional(),
  notify_release: z.boolean().optional(),
  notify_sms: z.boolean().optional(),
  notify_ambiguity: z.boolean().optional(),
});

const methodSchema = z.object({
  id: z.string().uuid().optional(),
  country: z.string().min(2).max(10),
  method_type: z.string().min(1).max(80),
  bank_name: z.string().min(1).max(120),
  account_name: z.string().min(1).max(120),
  account_number: z.string().max(80).nullable().optional(),
  iban: z.string().max(80).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const getBotState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { loadState } = await import("./bot-api.server");
    return loadState(context.userId);
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { updateSettings } = await import("./bot-api.server");
    return updateSettings(context.userId, data);
  });

export const testBinanceKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { testKeys } = await import("./bot-api.server");
    return testKeys(context.userId);
  });

export const testTelegram = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { testTelegramAlert } = await import("./bot-api.server");
    return testTelegramAlert(context.userId);
  });

export const syncOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runSync } = await import("./bot-api.server");
    return runSync(context.userId);
  });

export const releaseUsdt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    const { runManualRelease } = await import("./bot-api.server");
    return runManualRelease(context.userId, data.orderId);
  });

export const savePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => methodSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { upsertPaymentMethod } = await import("./bot-api.server");
    return upsertPaymentMethod(context.userId, data);
  });

export const deletePaymentMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { removePaymentMethod } = await import("./bot-api.server");
    return removePaymentMethod(context.userId, data.id);
  });

export const simulateSms = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ text: z.string().min(3).max(2000) }).parse(input))
  .handler(async ({ data, context }) => {
    const { runSmsTest } = await import("./bot-api.server");
    return runSmsTest(context.userId, data.text);
  });

export const clearSystemLogsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { clearSystemLogs } = await import("./bot-api.server");
    return clearSystemLogs(context.userId);
  });

export const clearSmsHistoryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { clearSmsHistory } = await import("./bot-api.server");
    return clearSmsHistory(context.userId);
  });

export const deleteSmsEntryFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { deleteSmsEntry } = await import("./bot-api.server");
    return deleteSmsEntry(context.userId, data.id);
  });
