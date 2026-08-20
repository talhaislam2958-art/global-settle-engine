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

        // The scheduler wakes us once a minute. Each user's configurable poll
        // interval decides how many times we re-sync within that window, so
        // detection can be as fast as a few seconds without extra cron jobs.
        const WINDOW_MS = 55_000;
        const startedAt = Date.now();
        const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

        const results: Array<{ user_id: string; ok: boolean; message: string; passes: number }> = [];
        for (const settings of active ?? []) {
          const interval = Math.min(
            300,
            Math.max(2, Number((settings as { poll_interval_seconds?: number }).poll_interval_seconds ?? 60)),
          );
          let passes = 0;
          let last = { ok: false, message: "" } as { ok: boolean; message?: string };
          do {
            last = await syncOrdersForUser(settings as never);
            passes += 1;
            if (Date.now() - startedAt + interval * 1000 >= WINDOW_MS) break;
            await sleep(interval * 1000);
          } while (Date.now() - startedAt < WINDOW_MS);
          results.push({ user_id: settings.user_id, ok: last.ok, message: last.message ?? "", passes });
        }

        return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
