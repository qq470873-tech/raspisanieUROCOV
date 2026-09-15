"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, Tag, X } from "lucide-react";
import { apiPost } from "@/lib/client";
import { WEEKDAYS, formatRange } from "@/lib/domain";
import type { PricingData, SlotPricing } from "@/lib/accounting";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** Рубли <-> копейки. */
const toKop = (rub: string) => Math.max(0, Math.round(parseFloat(rub.replace(",", ".")) * 100 || 0));
const toRub = (kop: number) => (kop / 100).toString();

export function PricingSection() {
  const [data, setData] = useState<PricingData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/accounting/pricing");
      if (!res.ok) throw new Error("Не удалось загрузить");
      setData(await res.json());
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function mutate(body: Record<string, unknown>) {
    await apiPost("/api/accounting/pricing", body);
    await load();
  }

  if (loading) return <Card className="p-8 text-center text-muted-foreground">Загрузка…</Card>;
  if (!data) return null;

  const activeSlots = data.slots.filter((s) => s.is_active);

  return (
    <div className="flex flex-col gap-4">
      <DefaultPrice
        value={data.defaultPriceKopecks}
        onSave={(kop) => mutate({ action: "default", price_kopecks: kop })}
      />

      {activeSlots.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Нет активных занятий в расписании.
        </Card>
      ) : (
        WEEKDAYS.map((day) => {
          const slots = activeSlots.filter((s) => s.weekday === day.value);
          if (slots.length === 0) return null;
          return (
            <div key={day.value} className="flex flex-col gap-2">
              <h3 className="px-1 text-sm font-semibold text-muted-foreground">{day.long}</h3>
              {slots.map((slot) => (
                <SlotPriceCard
                  key={slot.id}
                  slot={slot}
                  defaultPrice={data.defaultPriceKopecks}
                  students={data.students}
                  onMutate={mutate}
                />
              ))}
            </div>
          );
        })
      )}
    </div>
  );
}

function DefaultPrice({ value, onSave }: { value: number; onSave: (kop: number) => Promise<void> }) {
  const [rub, setRub] = useState(toRub(value));
  const [busy, setBusy] = useState(false);
  const changed = toKop(rub) !== value;

  return (
    <Card className="flex flex-col gap-2 border-primary/20 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <div className="flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Tag className="size-4 text-primary" /> Цена по умолчанию
        </p>
        <p className="text-xs text-muted-foreground">Подставляется при добавлении нового плательщика.</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          value={rub}
          onChange={(e) => setRub(e.target.value)}
          inputMode="decimal"
          className="w-28"
        />
        <span className="text-sm text-muted-foreground">₽</span>
        <Button
          size="sm"
          disabled={!changed || busy}
          onClick={async () => {
            setBusy(true);
            await onSave(toKop(rub)).finally(() => setBusy(false));
            toast.success("Сохранено");
          }}
        >
          Сохранить
        </Button>
      </div>
    </Card>
  );
}

function SlotPriceCard({
  slot,
  defaultPrice,
  students,
  onMutate,
}: {
  slot: SlotPricing;
  defaultPrice: number;
  students: { id: string; name: string }[];
  onMutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState(toRub(defaultPrice));

  // Ученики, которых ещё нет среди плательщиков этого слота (для подсказок).
  const suggestions = useMemo(
    () => students.filter((s) => !slot.payers.some((p) => p.student_id === s.id)),
    [students, slot.payers],
  );

  async function add() {
    if (!newName.trim()) {
      toast.error("Укажите имя");
      return;
    }
    await onMutate({ action: "add", slot_id: slot.id, name: newName.trim(), price_kopecks: toKop(newPrice) });
    setNewName("");
    setNewPrice(toRub(defaultPrice));
    setAdding(false);
    toast.success("Плательщик добавлен");
  }

  return (
    <Card className="flex flex-col gap-2 p-3.5">
      <div className="flex items-center justify-between">
        <span className="font-medium tabular-nums">{formatRange(slot.start_time, slot.end_time)}</span>
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setAdding((v) => !v)}>
          <Plus className="size-3.5" /> Плательщик
        </Button>
      </div>

      {slot.payers.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">Цена не задана.</p>
      )}

      {slot.payers.map((p) => (
        <PayerRow
          key={p.student_id}
          name={p.name}
          price={p.price_kopecks}
          source={p.source}
          onSave={(kop) =>
            onMutate({ action: "upsert", slot_id: slot.id, student_id: p.student_id, price_kopecks: kop })
          }
          onRemove={() =>
            onMutate({ action: "remove", slot_id: slot.id, student_id: p.student_id })
          }
        />
      ))}

      {adding && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/50 p-2">
          <Input
            list={`students-${slot.id}`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Имя ученика"
            className="h-8 flex-1 min-w-32"
            autoFocus
          />
          <datalist id={`students-${slot.id}`}>
            {suggestions.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          <Input
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            inputMode="decimal"
            className="h-8 w-20"
          />
          <span className="text-sm text-muted-foreground">₽</span>
          <Button size="icon-sm" onClick={add} title="Добавить">
            <Check className="size-4" />
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={() => setAdding(false)} title="Отмена">
            <X className="size-4" />
          </Button>
        </div>
      )}
    </Card>
  );
}

function PayerRow({
  name,
  price,
  source,
  onSave,
  onRemove,
}: {
  name: string;
  price: number;
  source: "schedule" | "extra";
  onSave: (kop: number) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [rub, setRub] = useState(toRub(price));
  const [busy, setBusy] = useState(false);
  const changed = toKop(rub) !== price;

  async function save() {
    if (!changed) return;
    setBusy(true);
    await onSave(toKop(rub)).finally(() => setBusy(false));
    toast.success("Цена сохранена");
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 truncate text-sm">{name}</span>
      <Input
        value={rub}
        onChange={(e) => setRub(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
        inputMode="decimal"
        className="h-8 w-20"
      />
      <span className="text-sm text-muted-foreground">₽</span>
      <Button size="icon-sm" variant={changed ? "default" : "ghost"} disabled={!changed || busy} onClick={save} title="Сохранить">
        <Check className="size-4" />
      </Button>
      <Button
        size="icon-sm"
        variant="ghost"
        onClick={onRemove}
        title={source === "extra" ? "Убрать плательщика" : "Сбросить цену к дефолтной"}
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
