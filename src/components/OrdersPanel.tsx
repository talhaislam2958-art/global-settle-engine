import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { BadgeCheck, Gavel, Hourglass, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { releaseUsdt } from "@/lib/bot.functions";
import type { OrderRow } from "@/lib/types";

const TABS = [
  { key: "ongoing", label: "Ongoing", icon: Hourglass },
  { key: "paid", label: "Paid", icon: BadgeCheck },
  { key: "appeal", label: "Appeal", icon: Gavel },
] as const;

function OrderCard({ order, onChanged }: { order: OrderRow; onChanged: () => void }) {
  const release = useServerFn(releaseUsdt);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-surface-2 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Binance Order ID</p>
          <p className="mono text-sm font-semibold">{order.order_id}</p>
          <p className="text-sm">
            <span className="text-muted-foreground">Buyer: </span>
            <span className="font-semibold">{order.buyer_username ?? "—"}</span>
            {order.buyer_real_name ? (
              <span className="text-muted-foreground"> · {order.buyer_real_name}</span>
            ) : null}
          </p>
        </div>
        <div className="text-right">
          <p className="mono text-base font-semibold">
            {Number(order.fiat_amount).toLocaleString()} {order.fiat_currency}
          </p>
          <p className="mono text-xs text-muted-foreground">
            {Number(order.crypto_amount)} {order.asset}
            {order.unit_price ? ` @ ${order.unit_price}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Badge variant="secondary">{order.payment_method ?? "method n/a"}</Badge>
        {order.payment_verified ? <Badge>payment verified</Badge> : null}
        {order.released ? <Badge variant="outline">released</Badge> : null}
        {order.trade_type ? <Badge variant="outline">{order.trade_type}</Badge> : null}
        <span className="mono text-xs text-muted-foreground">
          {new Date(order.order_created_at ?? order.created_at).toLocaleString()}
        </span>
        {order.status !== "appeal" && !order.released ? (
          <Button
            size="sm"
            className="ml-auto"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const res = (await release({ data: { orderId: order.order_id } })) as {
                  ok: boolean;
                  message: string;
                };
                res.ok ? toast.success(res.message) : toast.error(res.message);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Release failed");
              } finally {
                setBusy(false);
                onChanged();
              }
            }}
          >
            <Send className="h-3.5 w-3.5" /> Release USDT
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function OrdersPanel({ orders, onChanged }: { orders: OrderRow[]; onChanged: () => void }) {
  return (
    <div className="panel p-5">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider">Orders</h2>
      <Tabs defaultValue="ongoing">
        <TabsList className="w-full">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key} className="flex-1 gap-1.5">
              <t.icon className="h-3.5 w-3.5" />
              {t.label}
              <span className="mono text-xs opacity-70">
                {orders.filter((o) => o.status === t.key).length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {TABS.map((t) => {
          const list = orders.filter((o) => o.status === t.key);
          return (
            <TabsContent key={t.key} value={t.key} className="mt-4 space-y-3">
              {list.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  No {t.label.toLowerCase()} orders. Orders sync automatically from Binance P2P.
                </p>
              ) : (
                list.map((o) => <OrderCard key={o.id} order={o} onChanged={onChanged} />)
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
