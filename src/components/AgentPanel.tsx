import { Bot, Copy, Terminal, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { AutomationTaskRow, BotStateSettings } from "@/lib/types";

function statusTone(status: string) {
  if (status === "done") return "text-primary";
  if (status === "failed") return "text-destructive";
  if (status === "claimed") return "text-warning";
  return "text-muted-foreground";
}

export function AgentPanel({
  settings,
  tasks,
}: {
  settings: BotStateSettings;
  tasks: AutomationTaskRow[];
}) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const command = `AGENT_TOKEN=${settings.agent_token} APP_URL=${origin} node p2p-agent.mjs`;

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Bot className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">Browser automation agent</h2>
        <span
          className={`ml-auto flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
            settings.agent_online
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-surface-2 text-muted-foreground"
          }`}
        >
          {settings.agent_online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
          {settings.agent_online ? "Online" : "Offline"}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">
        The cloud engine reads orders through the Binance API. Chat messages with your bank details and the
        USDT release click are executed by this agent in a real logged-in Binance session — that is the only
        reliable path, since Binance blocks those actions over the API.
        {settings.agent_last_seen_at
          ? ` Last seen ${new Date(settings.agent_last_seen_at).toLocaleString()}${settings.agent_version ? ` · v${settings.agent_version}` : ""}.`
          : " Not connected yet."}
      </p>

      <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
        <Label className="text-xs uppercase tracking-wider text-muted-foreground">Run the agent</Label>
        <p className="mono break-all text-xs text-foreground">{command}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(command);
              toast.success("Start command copied");
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Copy command
          </Button>
          <Button size="sm" variant="secondary" asChild>
            <a href="/agent/p2p-agent.mjs" download>
              Download agent script
            </a>
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          On any always-on machine: <span className="mono">npm i playwright &amp;&amp; npx playwright install chromium</span>,
          then run with <span className="mono">HEADLESS=false</span> once to sign in to Binance. Keep this token secret.
        </p>
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <Terminal className="h-3.5 w-3.5 text-primary" />
          <h3 className="text-xs font-semibold uppercase tracking-wider">Automation queue</h3>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-border bg-surface-2 p-3">
          {tasks.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No automation tasks yet.</p>
          ) : (
            tasks.map((t) => (
              <p key={t.id} className="mono flex flex-wrap gap-2 text-xs leading-relaxed">
                <span className="shrink-0 text-muted-foreground">
                  {new Date(t.created_at).toLocaleTimeString()}
                </span>
                <span className="shrink-0 text-foreground/85">
                  {t.task_type === "send_bank_details" ? "CHAT" : "RELEASE"}
                </span>
                <span className="shrink-0 text-foreground">#{t.order_id}</span>
                {t.buyer_username ? <span className="shrink-0 text-muted-foreground">{t.buyer_username}</span> : null}
                <span className={`shrink-0 uppercase ${statusTone(t.status)}`}>{t.status}</span>
                {t.result ? <span className="text-muted-foreground">{t.result.slice(0, 120)}</span> : null}
              </p>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
