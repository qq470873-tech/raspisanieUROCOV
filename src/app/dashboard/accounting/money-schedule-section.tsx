"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarOff, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { apiPost } from "@/lib/client";
import { cn } from "@/lib/utils";
import { WEEKDAYS, formatRange } from "@/lib/domain";
import { addDays, currentWeekMonday, formatDayMonth, formatMoney } from "@/lib/time-nn";
import type { MoneySlot } from "@/lib/accounting";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

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
  const [week, setWeek] = useState(() => currentWeekMonday());
  const [slots, setSlots] = useState<MoneySlot[]>([]);
  const [seasonStart, setSeasonStart] = useState<string | null>(null);
  const [weekIncome, setWeekIncome] = useState(0);
  const [monthIncome, setMonthIncome] = useState(0);
  const [monthLabel, setMonthLabel] = useState("");
  const [debtors, setDebtors] = useState<{ name: string; amountKopecks: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/accounting/schedule?week=${week}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Не удалось загрузить"))))
      .then((data) => {
        if (cancelled) return;
        setSlots(data.slots);
        setSeasonStart(data.seasonStartMonday);
        setWeekIncome(data.weekIncomeKopecks ?? 0);
        setMonthIncome(data.monthIncomeKopecks ?? 0);
        setMonthLabel(data.monthLabel ?? "");
        setDebtors(data.debtors ?? []);
      })
      .catch((e) => !cancelled && toast.error(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [week, reloadToken]);

  async function toggleException(slotId: string, date: string, on: boolean) {
    await apiPost("/api/accounting/schedule", { slot_id: slotId, date, on });
    setReloadToken((t) => t + 1);
  }

  const weekEnd = addDays(week, 6);
  const maxWeek = seasonStart ? addDays(seasonStart, 51 * 7) : week;
  const canPrev = !seasonStart || week > seasonStart;
  const canNext = week < maxWeek;
  const isCurrent = week === currentWeekMonday();

  return (
    <div className="flex flex-col gap-4">
      {/* Навигация по неделям */}
      <Card className="flex flex-wrap items-center justify-between gap-2 p-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={!canPrev}
            onClick={() => setWeek(addDays(week, -7))}
            title="Предыдущая неделя"
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-40 text-center text-sm font-semibold tabular-nums">
            {formatDayMonth(week)} — {formatDayMonth(weekEnd)}
            {isCurrent && <span className="ml-1 text-primary">· сейчас</span>}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={!canNext}
            onClick={() => setWeek(addDays(week, 7))}
            title="Следующая неделя"
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
        {!isCurrent && (
          <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setWeek(currentWeekMonday())}>
            <RotateCcw className="size-3.5" /> К текущей неделе
          </Button>
        )}
        <Legend />
      </Card>

      {/* Доход + должники */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Доход за неделю</p>
          <p className="text-lg font-semibold tabular-nums">{formatMoney(weekIncome)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Доход за {monthLabel}</p>
          <p className="text-lg font-semibold tabular-nums">{formatMoney(monthIncome)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted-foreground">Должники ({debtors.length})</p>
          {debtors.length === 0 ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-300">Долгов нет 🎉</p>
          ) : (
            <div className="mt-0.5 flex flex-col gap-0.5 text-sm">
              {debtors.slice(0, 3).map((d) => (
                <div key={d.name} className="flex justify-between gap-2">
                  <span className="truncate">{d.name}</span>
                  <span className="shrink-0 font-medium tabular-nums text-red-600 dark:text-red-300">
                    {formatMoney(d.amountKopecks)}
                  </span>
                </div>
              ))}
              {debtors.length > 3 && (
                <span className="text-xs text-muted-foreground">и ещё {debtors.length - 3}…</span>
              )}
            </div>
          )}
        </Card>
      </div>

      {loading && slots.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Загрузка…</Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {WEEKDAYS.map((day) => {
            const daySlots = slots.filter((s) => s.weekday === day.value);
            if (daySlots.length === 0) return null;
            return (
              <div key={day.value} className="flex flex-col gap-2">
                <h3 className="px-1 text-sm font-semibold text-muted-foreground">
                  {day.short} · {daySlots[0] ? formatDayMonth(daySlots[0].date) : ""}
                </h3>
                {daySlots.map((slot) => (
                  <SlotCard key={slot.id} slot={slot} onToggle={toggleException} />
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Legend() {
  const item = (cls: string, label: string) => (
    <span className="flex items-center gap-1">
      <span className={cn("size-2.5 rounded-full", cls)} /> {label}
    </span>
  );
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {item("bg-emerald-500", "оплачено")}
      {item("bg-red-500", "долг")}
      {item("bg-gradient-to-r from-red-500 to-sky-500", "частично")}
    </div>
  );
}

function SlotCard({
  slot,
  onToggle,
}: {
  slot: MoneySlot;
  onToggle: (slotId: string, date: string, on: boolean) => Promise<void>;
}) {
  const state = slotState(slot);

  return (
    <Card
      className={cn(
        "flex flex-col gap-1.5 border-l-4 p-2.5 text-sm",
        BORDER[state],
        slot.skipped && "opacity-50",
      )}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-medium tabular-nums">{formatRange(slot.start_time, slot.end_time)}</span>
        <button
          onClick={() => onToggle(slot.id, slot.date, !slot.skipped)}
          className={cn(
            "rounded p-1 transition-colors hover:bg-foreground/10",
            slot.skipped ? "text-amber-600" : "text-muted-foreground",
          )}
          title={slot.skipped ? "Вернуть урок" : "Урока не было"}
        >
          {slot.skipped ? <RotateCcw className="size-3.5" /> : <CalendarOff className="size-3.5" />}
        </button>
      </div>

      {slot.skipped ? (
        <span className="text-xs text-amber-600">урока не было</span>
      ) : slot.payers.length === 0 ? (
        <span className="text-xs text-muted-foreground">цена не задана</span>
      ) : (
        slot.payers.map((p) => (
          <div key={p.student_id} className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-2 shrink-0 rounded-full",
                p.status === "paid" ? "bg-emerald-500" : "bg-red-500",
              )}
            />
            <span className="flex-1 truncate text-xs">{p.name}</span>
            <span
              className={cn(
                "shrink-0 text-[11px]",
                p.status === "paid" ? "text-emerald-600 dark:text-emerald-300" : "text-red-600 dark:text-red-300",
              )}
            >
              {p.status === "paid" ? "оплачено" : "долг"}
            </span>
          </div>
        ))
      )}
    </Card>
  );
}
