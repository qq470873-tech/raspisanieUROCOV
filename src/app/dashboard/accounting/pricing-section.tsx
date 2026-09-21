"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, Check, Plus, Tag, Trash2, X } from "lucide-react";
import { apiPost } from "@/lib/client";
import { WEEKDAYS, formatRange } from "@/lib/domain";
import type { PricingData, SlotPricing } from "@/lib/accounting";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

      <AddSlot onAdd={(body) => mutate(body)} />

      {activeSlots.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Пока нет занятий. Добавьте занятие выше — это расписание бухгалтерии,
          независимое от основного.
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
                  onDelete={() => mutate({ action: "slot_delete", slot_id: slot.id })}
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
        <p className="text-xs text-muted-foreground">Подставляется при добавлении нового ученика.</p>
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

function AddSlot({ onAdd }: { onAdd: (body: Record<string, unknown>) => Promise<void> }) {
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("16:00");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!start || !end) {
      toast.error("Укажите время");
      return;
    }
    setBusy(true);
    try {
      await onAdd({ action: "slot_add", weekday: Number(weekday), start_time: start, end_time: end });
      toast.success("Занятие добавлено");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-2 p-4">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <CalendarPlus className="size-4 text-primary" /> Добавить занятие
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Select value={weekday} onValueChange={(v) => v && setWeekday(v)}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WEEKDAYS.map((d) => (
              <SelectItem key={d.value} value={String(d.value)}>
                {d.long}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-28" />
        <span className="pb-2 text-muted-foreground">–</span>
        <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-28" />
        <Button className="gap-1" disabled={busy} onClick={submit}>
          <Plus className="size-4" /> Добавить
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
  onDelete,
}: {
  slot: SlotPricing;
  defaultPrice: number;
  students: { id: string; name: string }[];
  onMutate: (body: Record<string, unknown>) => Promise<void>;
  onDelete: () => Promise<void>;
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
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="gap-1" onClick={() => setAdding((v) => !v)}>
            <Plus className="size-3.5" /> Ученик
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-red-600"
            onClick={async () => {
              if (slot.payers.length > 0 && !confirm("Удалить занятие вместе с учениками из бухгалтерии?"))
                return;
              await onDelete();
              toast.success("Занятие удалено");
            }}
            title="Удалить занятие"
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>

      {slot.payers.length === 0 && !adding && (
        <p className="text-xs text-muted-foreground">Нет учеников. Нажмите «Ученик».</p>
      )}

      {slot.payers.map((p) => (
        <PayerRow
          key={p.student_id}
          name={p.name}
          price={p.price_kopecks}
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
  onSave,
  onRemove,
}: {
  name: string;
  price: number;
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
        title="Убрать ученика с занятия"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}
