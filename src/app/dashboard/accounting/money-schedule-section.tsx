"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarOff, RotateCcw } from "lucide-react";
import { apiPost } from "@/lib/client";
import { cn } from "@/lib/utils";
import { WEEKDAYS, formatRange } from "@/lib/domain";
import { formatDayMonth, formatMoney } from "@/lib/time-nn";
import type { MoneySlot } from "@/lib/accounting";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type SlotState = "paid" | "partial" | "debt" | "none";

function slotState(slot: MoneySlot): SlotState {
  if (slot.payers.length === 0) return "none";
  const paid = slot.payers.filter((p) => p.status === "paid").length;
  if (paid === slot.payers.length) return "paid";
  if (paid === 0) return "debt";
  return "partial";
}

const BORDER: Record<SlotState, string> = {
  paid: "border-l-emerald-500",
  debt: "border-l-red-500",
  partial: "border-l-red-500 pulse-partial",
  none: "border-l-muted-foreground/30",
};

export function MoneyScheduleSection() {
  const [slots, setSlots] = useState<MoneySlot[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/accounting/schedule");
      if (!res.ok) throw new Error("Не удалось загрузить");
      setSlots((await res.json()).slots);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function toggleException(slotId: string, date: string, on: boolean) {
    await apiPost("/api/accounting/schedule", { slot_id: slotId, date, on });
    await load();
  }

  if (loading) return <Card className="p-8 text-center text-muted-foreground">Загрузка…</Card>;

  if (slots.length === 0) {
    return <Card className="p-8 text-center text-muted-foreground">Нет активных занятий.</Card>;
  }

  return (
    <div className="flex flex-col gap-4">
      <Legend />
      {WEEKDAYS.map((day) => {
        const daySlots = slots.filter((s) => s.weekday === day.value);
        if (daySlots.length === 0) return null;
        return (
          <div key={day.value} className="flex flex-col gap-2">
            <h3 className="px-1 text-sm font-semibold text-muted-foreground">{day.long}</h3>
            {daySlots.map((slot) => (
              <SlotCard key={slot.id} slot={slot} onToggle={toggleException} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function Legend() {
  const item = (cls: string, label: string) => (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-3 rounded-full", cls)} /> {label}
    </span>
  );
  return (
    <Card className="flex flex-wrap gap-x-4 gap-y-2 p-3 text-xs text-muted-foreground">
      {item("bg-emerald-500", "оплачено")}
      {item("bg-red-500", "долг / не указано")}
      {item("bg-gradient-to-r from-red-500 to-sky-500", "частично (в группе)")}
    </Card>
  );
}

function SlotCard({
  slot,
  onToggle,
}: {
  slot: MoneySlot;
  onToggle: (slotId: string, date: string, on: boolean) => Promise<void>;
}) {
  const [customDate, setCustomDate] = useState(slot.thisWeekDate);
  const state = slotState(slot);
  const thisWeekSkipped = slot.exceptions.includes(slot.thisWeekDate);

  return (
    <Card className={cn("flex flex-col gap-2 border-l-4 p-3.5", BORDER[state])}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <span className="font-medium tabular-nums">{formatRange(slot.start_time, slot.end_time)}</span>
          <span className="text-xs text-muted-foreground">· {formatDayMonth(slot.thisWeekDate)}</span>
        </div>
        {slot.payers.length === 0 && (
          <span className="text-xs text-muted-foreground">цена не задана</span>
        )}
      </div>

      {slot.payers.map((p) => (
        <div key={p.student_id} className="flex items-center gap-2 text-sm">
          <span
            className={cn(
              "size-2 shrink-0 rounded-full",
              p.status === "paid" ? "bg-emerald-500" : "bg-red-500",
            )}
          />
          <span className="flex-1 truncate">{p.name}</span>
          <span
            className={cn(
              "tabular-nums text-xs",
              p.status === "paid"
                ? "text-emerald-600 dark:text-emerald-300"
                : "text-red-600 dark:text-red-300",
            )}
          >
            {p.status === "paid" ? "оплачено" : "долг"} · {formatMoney(p.balanceKopecks)}
          </span>
        </div>
      ))}

      {/* Урока не было */}
      <div className="flex flex-wrap items-center gap-2 border-t pt-2">
        {thisWeekSkipped ? (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5 text-amber-600"
            onClick={() => onToggle(slot.id, slot.thisWeekDate, false)}
          >
            <RotateCcw className="size-3.5" /> Вернуть урок ({formatDayMonth(slot.thisWeekDate)})
          </Button>
        ) : (
          <>
            <Input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="h-8 w-40"
            />
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onToggle(slot.id, customDate, true)}
            >
              <CalendarOff className="size-3.5" /> Урока не было
            </Button>
          </>
        )}
      </div>

      {/* Отмеченные даты */}
      {slot.exceptions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {slot.exceptions.map((d) => (
            <button
              key={d}
              onClick={() => onToggle(slot.id, d, false)}
              className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-700 hover:bg-amber-500/25 dark:text-amber-300"
              title="Снять отметку «урока не было»"
            >
              {formatDayMonth(d)} · не было ✕
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}
