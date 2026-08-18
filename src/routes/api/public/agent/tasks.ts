import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Browser-automation agent endpoint.
// The agent authenticates with the account's agent token (Authorization: Bearer
// <token> or x-agent-token) — this route is public so an external worker can
// reach it, so the token check IS the security boundary. No PII is returned
// beyond the merchant's own order/payment data for that token.

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type, authorization, x-agent-token",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });

const claimSchema = z.object({
  action: z.literal("claim"),
  version: z.string().max(40).nullish(),
  limit: z.coerce.number().int().min(1).max(20).optional(),
});

const completeSchema = z.object({
  action: z.literal("complete"),
  task_id: z.string().uuid(),
  ok: z.boolean(),
  result: z.string().min(1).max(1000),
  version: z.string().max(40).nullish(),
});

const bodySchema = z.discriminatedUnion("action", [claimSchema, completeSchema]);

export const Route = createFileRoute("/api/public/agent/tasks")({
  server: {
    handlers: {
      OPTIONS: async () => json({ ok: true }, 204),
      POST: async ({ request }) => {
        const header = request.headers.get("authorization") ?? "";
        const token = header.toLowerCase().startsWith("bearer ")
          ? header.slice(7).trim()
          : (request.headers.get("x-agent-token") ?? "").trim();
        if (token.length < 16) return json({ error: "Missing agent token" }, 401);

        const raw = await request.json().catch(() => null);
        const parsed = bodySchema.safeParse(raw);
        if (!parsed.success) return json({ error: "Invalid payload", issues: parsed.error.issues }, 400);

        const { settingsByAgentToken, touchAgent, claimTasks, completeTask } = await import(
          "@/lib/automation.server"
        );
        const settings = await settingsByAgentToken(token);
        if (!settings) return json({ error: "Unauthorized" }, 401);

        await touchAgent(settings.user_id, parsed.data.version ?? null);

        if (parsed.data.action === "claim") {
          if (!settings.bot_running) return json({ ok: true, paused: true, tasks: [] });
          const tasks = await claimTasks(settings, parsed.data.limit ?? 5);
          return json({ ok: true, paused: false, tasks });
        }

        const res = await completeTask(settings, parsed.data.task_id, parsed.data.ok, parsed.data.result);
        return json(res, res.ok ? 200 : 404);
      },
    },
  },
});
