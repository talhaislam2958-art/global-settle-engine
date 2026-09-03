import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MessageSquareText, TestTube } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { simulateSms } from "@/lib/bot.functions";
import type { SmsRow } from "@/lib/types";

function statusVariant(status: string) {
  if (status === "released") return "default" as const;
  if (status === "matched") return "secondary" as const;
  return "outline" as const;
}

export function SmsPanel({ logs, onChanged }: { logs: SmsRow[]; onChanged: () => void }) {
  const test = useServerFn(simulateSms);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center gap-2">
        <MessageSquareText className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">SMS logs &amp; verification</h2>
      </div>

      <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
        <Textarea
          rows={3}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste a payment SMS to test the matching engine, e.g. 'Rs 25,000 received from AHMED KHAN. TID 998877'"
        />
        <Button
          size="sm"
          variant="secondary"
          disabled={busy || text.trim().length < 3}
          onClick={async () => {
            setBusy(true);
            try {
              const res = (await test({ data: { text } })) as { matched: boolean; order_id: string | null };
              res.matched
                ? toast.success(`Matched to order ${res.order_id}`)
                : toast.warning("No matching pending order found");
              setText("");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Test failed");
            } finally {
              setBusy(false);
              onChanged();
            }
          }}
        >
          <TestTube className="h-3.5 w-3.5" /> Run through matching engine
        </Button>
      </div>

      <div className="space-y-3">
        {logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No payment SMS received yet. Point your SMS forwarder at the webhook URL.
          </p>
        ) : (
          logs.map((s) => (
            <div key={s.id} className="rounded-xl border border-border bg-surface-2 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={statusVariant(s.match_status)}>{s.match_status}</Badge>
                {s.amount != null ? (
                  <span className="mono text-sm font-semibold">{Number(s.amount).toLocaleString()}</span>
                ) : null}
                {s.reference_id ? (
                  <span className="mono text-xs text-muted-foreground">TID {s.reference_id}</span>
                ) : null}
                <span className="mono ml-auto text-xs text-muted-foreground">
                  {new Date(s.created_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-foreground/90">{s.raw_text}</p>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <p>From: {s.payer_name ?? s.sender ?? "—"}</p>
                <p>Order: <span className="mono">{s.matched_order_id ?? "unmatched"}</span></p>
                <p>Buyer: {s.matched_buyer_username ?? "—"}</p>
                <p>Action: {s.action_taken ?? "—"}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
