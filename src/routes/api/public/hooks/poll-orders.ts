import { createFileRoute } from "@tanstack/react-router";

// Cloud-side heartbeat: called on a schedule so the bot keeps syncing orders
// 24/7, regardless of whether the merchant's device is on.
export const Route = createFileRoute("/api/public/hooks/poll-orders")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = request.headers.get("apikey");
        if (!apiKey || apiKey !== process.env["SUPABASE_PUBLISHABLE_KEY"]) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { syncOrdersForUser } = await import("@/lib/bot-engine.server");

        const { data: active } = await supabaseAdmin
          .from("bot_settings")
          .select("*")
          .eq("bot_running", true)
          .not("binance_api_key", "is", null);

        const results: Array<{ user_id: string; ok: boolean; message: string }> = [];
        for (const settings of active ?? []) {
          const res = await syncOrdersForUser(settings as never);
          results.push({ user_id: settings.user_id, ok: res.ok, message: res.message ?? "" });
        }

        return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
