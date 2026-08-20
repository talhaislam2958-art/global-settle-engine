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

export function LogsPanel({ logs }: { logs: LogRow[] }) {
  return (
    <div className="panel p-5">
      <div className="mb-3 flex items-center gap-2">
        <Terminal className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">System logs</h2>
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
