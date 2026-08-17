import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const payloadSchema = z.object({
  token: z.string().min(8).max(100).optional(),
  text: z.string().min(2).max(4000),
  sender: z.string().max(120).nullish(),
  amount: z.coerce.number().nullish(),
  reference: z.string().max(120).nullish(),
  payer_name: z.string().max(160).nullish(),
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/public/sms/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        let raw: unknown;
        const contentType = request.headers.get("content-type") ?? "";
        if (contentType.includes("application/json")) {
          raw = await request.json().catch(() => null);
        } else {
          const form = await request.formData().catch(() => null);
          raw = form ? Object.fromEntries(form.entries()) : null;
        }
        if (!raw || typeof raw !== "object") return json({ error: "Invalid payload" }, 400);

        const parsed = payloadSchema.safeParse(raw);
        if (!parsed.success) return json({ error: "Invalid payload", issues: parsed.error.issues }, 400);

        const token =
          parsed.data.token ??
          url.searchParams.get("token") ??
          request.headers.get("x-webhook-token") ??
          "";
        if (!token) return json({ error: "Missing webhook token" }, 401);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: settings } = await supabaseAdmin
          .from("bot_settings")
          .select("*")
          .eq("webhook_token", token)
          .maybeSingle();
        if (!settings) return json({ error: "Unauthorized" }, 401);

        if (!settings.bot_running) {
          const { logEvent } = await import("@/lib/bot-engine.server");
          await logEvent(settings.user_id, "warning", "webhook_hit", "SMS received but the bot is stopped — ignored.");
          return json({ ok: true, ignored: "bot_stopped" });
        }

        const { processIncomingSms } = await import("@/lib/bot-engine.server");
        const result = await processIncomingSms(settings as never, {
          rawText: parsed.data.text,
          sender: parsed.data.sender ?? null,
          amount: parsed.data.amount ?? null,
          reference: parsed.data.reference ?? null,
          payerName: parsed.data.payer_name ?? null,
        });
        return json(result);
      },
    },
  },
});
