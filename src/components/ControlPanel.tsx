import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, KeyRound, Play, Power, RefreshCw, Send, ShieldCheck, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES } from "@/lib/countries";
import type { BotStateSettings } from "@/lib/types";
import { saveSettings, syncOrders, testBinanceKeys, testTelegram } from "@/lib/bot.functions";

export function ControlPanel({
  settings,
  onChanged,
}: {
  settings: BotStateSettings;
  onChanged: () => void;
}) {
  const save = useServerFn(saveSettings);
  const testKeys = useServerFn(testBinanceKeys);
  const testTg = useServerFn(testTelegram);
  const sync = useServerFn(syncOrders);

  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [tgToken, setTgToken] = useState("");
  const [tgChat, setTgChat] = useState(settings.telegram_chat_id ?? "");
  const [busy, setBusy] = useState<string | null>(null);

  const webhookUrl = `${typeof window === "undefined" ? "" : window.location.origin}/api/public/sms/webhook?token=${settings.webhook_token}`;

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(null);
      onChanged();
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {/* Master switches */}
      <div className="panel space-y-5 p-5 lg:col-span-1">
        <div className="flex items-center gap-2">
          <Power className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Master controls</h2>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-base font-semibold">Automation engine</p>
              <p className="text-xs text-muted-foreground">
                Runs in Lovable Cloud — keeps working with your devices off.
              </p>
            </div>
            <Switch
              checked={settings.bot_running}
              disabled={busy !== null}
              onCheckedChange={(v) =>
                run("bot", async () => {
                  await save({ data: { bot_running: v } });
                  toast.success(v ? "Bot started in the cloud" : "Bot stopped");
                })
              }
            />
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-2 p-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-display text-base font-semibold">Auto-release USDT</p>
              <p className="text-xs text-muted-foreground">
                {settings.auto_release
                  ? "Releases automatically once payment is verified."
                  : "Holds funds and sends a Telegram reminder instead."}
              </p>
            </div>
            <Switch
              checked={settings.auto_release}
              disabled={busy !== null}
              onCheckedChange={(v) =>
                run("auto", async () => {
                  await save({ data: { auto_release: v } });
                  toast.success(`Auto-release ${v ? "ON" : "OFF"}`);
                })
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Operating country</Label>
          <Select
            value={settings.country}
            onValueChange={(v) =>
              run("country", async () => {
                await save({ data: { country: v } });
                toast.success("Country updated");
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-72">
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.name} · {c.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Loads that country's standard banking / payment methods.
          </p>
        </div>

        <Button
          variant="secondary"
          className="w-full"
          disabled={busy !== null}
          onClick={() =>
            run("sync", async () => {
              const res = (await sync({})) as { ok: boolean; message: string };
              res.ok ? toast.success(res.message) : toast.error(res.message);
            })
          }
        >
          <RefreshCw className={`h-4 w-4 ${busy === "sync" ? "animate-spin" : ""}`} />
          Sync orders now
        </Button>
      </div>

      {/* Binance */}
      <div className="panel space-y-4 p-5">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Binance API</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Keys are stored encrypted server-side and are only ever used for this account.
          {settings.binance_api_key_masked ? ` Saved key: ${settings.binance_api_key_masked}` : ""}
        </p>
        <div className="space-y-2">
          <Label htmlFor="bkey">API Key</Label>
          <Input
            id="bkey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={settings.binance_connected ? "•••••• (saved)" : "Binance API key"}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="bsecret">Secret Key</Label>
          <Input
            id="bsecret"
            type="password"
            value={apiSecret}
            onChange={(e) => setApiSecret(e.target.value)}
            placeholder={settings.binance_connected ? "•••••• (saved)" : "Binance secret key"}
            autoComplete="off"
          />
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={busy !== null}
            onClick={() =>
              run("bsave", async () => {
                await save({ data: { binance_api_key: apiKey, binance_api_secret: apiSecret } });
                setApiKey("");
                setApiSecret("");
                toast.success("Binance keys saved");
              })
            }
          >
            <ShieldCheck className="h-4 w-4" /> Save
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            disabled={busy !== null}
            onClick={() =>
              run("btest", async () => {
                const res = (await testKeys({})) as { ok: boolean; message: string };
                res.ok ? toast.success(res.message) : toast.error(res.message);
              })
            }
          >
            <Zap className="h-4 w-4" /> Test
          </Button>
        </div>
      </div>

      {/* Telegram + webhook */}
      <div className="panel space-y-4 p-5">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-semibold uppercase tracking-wider">Telegram &amp; webhook</h2>
        </div>
        <div className="space-y-2">
          <Label htmlFor="tgtoken">Bot token</Label>
          <Input
            id="tgtoken"
            type="password"
            value={tgToken}
            onChange={(e) => setTgToken(e.target.value)}
            placeholder={settings.telegram_connected ? "•••••• (saved)" : "123456:ABC-DEF..."}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tgchat">Chat ID</Label>
          <Input id="tgchat" value={tgChat} onChange={(e) => setTgChat(e.target.value)} placeholder="-1001234567890" />
        </div>
        <div className="flex gap-2">
          <Button
            className="flex-1"
            disabled={busy !== null}
            onClick={() =>
              run("tgsave", async () => {
                await save({ data: { telegram_bot_token: tgToken, telegram_chat_id: tgChat } });
                setTgToken("");
                toast.success("Telegram settings saved");
              })
            }
          >
            <ShieldCheck className="h-4 w-4" /> Save
          </Button>
          <Button
            variant="secondary"
            className="flex-1"
            disabled={busy !== null}
            onClick={() =>
              run("tgtest", async () => {
                const res = (await testTg({})) as { ok: boolean; message: string };
                res.ok ? toast.success(res.message) : toast.error(res.message);
              })
            }
          >
            <Play className="h-4 w-4" /> Test alert
          </Button>
        </div>

        <div className="space-y-2 rounded-xl border border-border bg-surface-2 p-3">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">
            SMS forwarder webhook URL
          </Label>
          <p className="mono break-all text-xs text-foreground">{webhookUrl}</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              void navigator.clipboard.writeText(webhookUrl);
              toast.success("Webhook URL copied");
            }}
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </Button>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            POST JSON <span className="mono">{"{ text, sender, amount, reference, payer_name }"}</span> from
            MacroDroid or any SMS forwarder.
          </p>
        </div>
      </div>
    </div>
  );
}
