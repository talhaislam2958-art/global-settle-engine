import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Bot, CloudCog, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatusStrip } from "@/components/StatusStrip";
import { ControlPanel } from "@/components/ControlPanel";
import { OrdersPanel } from "@/components/OrdersPanel";
import { SmsPanel } from "@/components/SmsPanel";
import { PaymentMethodsPanel } from "@/components/PaymentMethodsPanel";
import { LogsPanel } from "@/components/LogsPanel";
import { supabase } from "@/integrations/supabase/client";
import { getBotState } from "@/lib/bot.functions";
import type { BotState } from "@/lib/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "P2P Auto-Release Console · Cloud Automation Dashboard" },
      {
        name: "description",
        content:
          "Cloud-hosted Binance P2P automation: track ongoing, paid and appeal orders, verify payment SMS by webhook, and auto-release USDT 24/7.",
      },
      { property: "og:title", content: "P2P Auto-Release Console" },
      {
        property: "og:description",
        content:
          "Run your Binance P2P desk 24/7 in the cloud with SMS payment verification and automatic USDT release.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const fetchState = useServerFn(getBotState);
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setAuthed(Boolean(data.session));
      if (!data.session) void navigate({ to: "/auth" });
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(Boolean(session));
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);

  const query = useQuery({
    queryKey: ["bot-state"],
    queryFn: () => fetchState({}) as Promise<BotState>,
    enabled: authed === true,
    refetchInterval: 20000,
  });

  useEffect(() => {
    if (authed !== true) return;
    const channel = supabase
      .channel("bot-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void query.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "sms_logs" }, () => void query.refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "system_logs" }, () => void query.refetch())
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  if (authed !== true || !query.data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Connecting to the cloud engine…</p>
      </main>
    );
  }

  const state = query.data;
  const refresh = () => void query.refetch();

  return (
    <main className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:py-10">
      <header className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Bot className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold sm:text-2xl">P2P Auto-Release Console</h1>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CloudCog className="h-3.5 w-3.5" />
            Hosted and running on Lovable Cloud — no device required
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={async () => {
            await supabase.auth.signOut();
            void navigate({ to: "/auth" });
          }}
        >
          <LogOut className="h-4 w-4" /> Sign out
        </Button>
      </header>

      <StatusStrip settings={state.settings} />
      <ControlPanel settings={state.settings} onChanged={refresh} />

      <div className="grid gap-5 xl:grid-cols-2">
        <OrdersPanel orders={state.orders} onChanged={refresh} />
        <SmsPanel logs={state.sms_logs} onChanged={refresh} />
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <PaymentMethodsPanel
          methods={state.payment_methods}
          country={state.settings.country}
          onChanged={refresh}
        />
        <LogsPanel logs={state.system_logs} />
      </div>
    </main>
  );
}
