import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Terminal, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clearSystemLogsFn } from "@/lib/bot.functions";
import type { LogRow } from "@/lib/types";

function tone(level: string) {
  if (level === "success") return "text-primary";
  if (level === "warning") return "text-warning";
  if (level === "error") return "text-destructive";
  return "text-muted-foreground";
}

export function LogsPanel({ logs, onChanged }: { logs: LogRow[]; onChanged?: () => void }) {
  const clear = useServerFn(clearSystemLogsFn);
  const [busy, setBusy] = useState(false);

  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <Terminal className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">System logs</h2>
        <Button
          size="sm"
          variant="secondary"
          className="ml-auto"
          disabled={busy || logs.length === 0}
          onClick={async () => {
            setBusy(true);
            try {
              const res = (await clear({})) as { message: string };
              toast.success(res.message);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not clear logs");
            } finally {
              setBusy(false);
              onChanged?.();
            }
          }}
        >
          <Trash2 className="h-3.5 w-3.5" /> Clear logs
        </Button>
      </div>
      <div className="max-h-[26rem] space-y-1 overflow-y-auto rounded-xl border border-border bg-surface-2 p-3">
        {logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No events yet.</p>
        ) : (
          logs.map((l) => (
            <p key={l.id} className="mono flex gap-2 text-xs leading-relaxed">
              <span className="shrink-0 text-muted-foreground">
                {new Date(l.created_at).toLocaleTimeString()}
              </span>
              <span className={`shrink-0 uppercase ${tone(l.level)}`}>{l.event_type}</span>
              <span className="text-foreground/85">{l.message}</span>
            </p>
          ))
        )}
      </div>
    </div>
  );
}
