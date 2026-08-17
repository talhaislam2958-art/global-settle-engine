import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Landmark, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { COUNTRIES, methodsFor } from "@/lib/countries";
import { deletePaymentMethod, savePaymentMethod } from "@/lib/bot.functions";
import type { PaymentMethodRow } from "@/lib/types";

export function PaymentMethodsPanel({
  methods,
  country,
  onChanged,
}: {
  methods: PaymentMethodRow[];
  country: string;
  onChanged: () => void;
}) {
  const save = useServerFn(savePaymentMethod);
  const remove = useServerFn(deletePaymentMethod);

  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    country,
    method_type: methodsFor(country)[0] ?? "Bank Transfer",
    bank_name: "",
    account_name: "",
    account_number: "",
    iban: "",
  });

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center gap-2">
        <Landmark className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold uppercase tracking-wider">Payment methods</h2>
        <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Active methods for the selected country are sent to buyers automatically with every new order alert.
      </p>

      {open ? (
        <div className="grid gap-3 rounded-xl border border-border bg-surface-2 p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Country</Label>
            <Select value={form.country} onValueChange={(v) => setForm((f) => ({ ...f, country: v, method_type: methodsFor(v)[0] ?? "Bank Transfer" }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Select value={form.method_type} onValueChange={(v) => set("method_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-64">
                {methodsFor(form.country).map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bank / provider name</Label>
            <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="Meezan Bank" />
          </div>
          <div className="space-y-1.5">
            <Label>Account holder (legal name)</Label>
            <Input value={form.account_name} onChange={(e) => set("account_name", e.target.value)} placeholder="As registered on Binance" />
          </div>
          <div className="space-y-1.5">
            <Label>Account number</Label>
            <Input value={form.account_number} onChange={(e) => set("account_number", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>IBAN (optional)</Label>
            <Input value={form.iban} onChange={(e) => set("iban", e.target.value)} />
          </div>
          <Button
            className="sm:col-span-2"
            disabled={busy || !form.bank_name || !form.account_name}
            onClick={async () => {
              setBusy(true);
              try {
                await save({
                  data: {
                    country: form.country,
                    method_type: form.method_type,
                    bank_name: form.bank_name,
                    account_name: form.account_name,
                    account_number: form.account_number || null,
                    iban: form.iban || null,
                  },
                });
                toast.success("Payment method saved");
                setForm((f) => ({ ...f, bank_name: "", account_name: "", account_number: "", iban: "" }));
                setOpen(false);
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Could not save");
              } finally {
                setBusy(false);
                onChanged();
              }
            }}
          >
            Save payment method
          </Button>
        </div>
      ) : null}

      <div className="space-y-2">
        {methods.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No payment methods yet.</p>
        ) : (
          methods.map((m) => (
            <div key={m.id} className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                  {m.bank_name}
                  <Badge variant="secondary">{m.method_type}</Badge>
                  <Badge variant="outline">{m.country}</Badge>
                </p>
                <p className="text-xs text-muted-foreground">{m.account_name}</p>
                <p className="mono text-xs text-muted-foreground">{m.account_number ?? m.iban ?? "—"}</p>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={async () => {
                  try {
                    await remove({ data: { id: m.id } });
                    toast.success("Removed");
                  } catch (error) {
                    toast.error(error instanceof Error ? error.message : "Could not remove");
                  } finally {
                    onChanged();
                  }
                }}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
