import { Activity, KeyRound, Radio, Send } from "lucide-react";
import type { BotStateSettings } from "@/lib/types";

function Pill({
  icon,
  label,
  value,
  ok,
  warn,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  ok: boolean;
  warn?: boolean;
}) {
  const tone = ok ? "text-primary" : warn ? "text-warning" : "text-muted-foreground";
  const dot = ok ? "bg-primary pulse-dot" : warn ? "bg-warning" : "bg-muted-foreground";
  return (
    <div className="panel flex items-center gap-3 px-4 py-3">
      <span className={`shrink-0 ${tone}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="flex items-center gap-2 truncate text-sm font-semibold">
          <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
          {value}
        </p>
      </div>
    </div>
  );
}

export function StatusStrip({ settings }: { settings: BotStateSettings }) {
  const lastPoll = settings.last_poll_at ? new Date(settings.last_poll_at).toLocaleTimeString() : "never";
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Pill
        icon={<Activity className="h-5 w-5" />}
        label="Cloud engine"
        value={settings.bot_running ? "Running 24/7" : "Stopped"}
        ok={settings.bot_running}
        warn={!settings.bot_running}
      />
      <Pill
        icon={<KeyRound className="h-5 w-5" />}
        label="Binance API"
        value={settings.binance_connected ? "Connected" : "Not configured"}
        ok={settings.binance_connected}
      />
      <Pill
        icon={<Send className="h-5 w-5" />}
        label="Telegram alerts"
        value={settings.telegram_connected ? "Active" : "Not configured"}
        ok={settings.telegram_connected}
      />
      <Pill
        icon={<Radio className="h-5 w-5" />}
        label="Webhook / last sync"
        value={settings.last_poll_status === "error" ? `Error · ${lastPoll}` : `Healthy · ${lastPoll}`}
        ok={settings.last_poll_status === "ok"}
        warn={settings.last_poll_status === "error"}
      />
    </div>
  );
}
