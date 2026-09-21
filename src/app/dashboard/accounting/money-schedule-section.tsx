"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarOff, CalendarPlus, Check, ChevronLeft, ChevronRight, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { apiPost } from "@/lib/client";
import { cn } from "@/lib/utils";
import { WEEKDAYS, formatRange } from "@/lib/domain";
import { addDays, currentWeekMonday, formatDayMonth, formatMoney } from "@/lib/time-nn";
import type { MoneySlot } from "@/lib/accounting";
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

/** Рубли -> копейки. */
const toKop = (rub: string) => Math.max(0, Math.round(parseFloat(rub.replace(",", ".")) * 100 || 0));

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
  const [students, setStudents] = useState<{ id: string; name: string }[]>([]);
  const [defaultPrice, setDefaultPrice] = useState(0);
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
        setStudents(data.students ?? []);
        setDefaultPrice(data.defaultPriceKopecks ?? 0);
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

  // Мутации расписания бухгалтерии (через тот же роут, что и «Расписание и цены»).
  async function mutateSchedule(body: Record<string, unknown>) {
    await apiPost("/api/accounting/pricing", body);
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

      <AddSlot onAdd={mutateSchedule} />

      {loading && slots.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">Загрузка…</Card>
      ) : slots.length === 0 ? (
        <Card className="p-8 text-center text-muted-foreground">
          Пока нет занятий. Добавьте занятие выше и впишите учеников.
        </Card>
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
                  <SlotCard
                    key={slot.id}
                    slot={slot}
                    students={students}
                    defaultPrice={defaultPrice}
                    onToggle={toggleException}
                    onMutate={mutateSchedule}
                  />
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

function AddSlot({ onAdd }: { onAdd: (body: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("16:00");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!start || !end) return toast.error("Укажите время");
    setBusy(true);
    try {
      await onAdd({ action: "slot_add", weekday: Number(weekday), start_time: start, end_time: end });
      toast.success("Занятие добавлено");
      setOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <div>
        <Button variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
          <CalendarPlus className="size-4" /> Добавить занятие
        </Button>
      </div>
    );
  }

  return (
    <Card className="flex flex-wrap items-end gap-2 p-3">
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
      <Button variant="ghost" onClick={() => setOpen(false)}>
        Отмена
      </Button>
    </Card>
  );
}

function SlotCard({
  slot,
  students,
  defaultPrice,
  onToggle,
  onMutate,
}: {
  slot: MoneySlot;
  students: { id: string; name: string }[];
  defaultPrice: number;
  onToggle: (slotId: string, date: string, on: boolean) => Promise<void>;
  onMutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const state = slotState(slot);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState((defaultPrice / 100).toString());

  const suggestions = useMemo(
    () => students.filter((s) => !slot.payers.some((p) => p.student_id === s.id)),
    [students, slot.payers],
  );

  async function addStudent() {
    if (!newName.trim()) return toast.error("Укажите имя");
    try {
      await onMutate({ action: "add", slot_id: slot.id, name: newName.trim(), price_kopecks: toKop(newPrice) });
      toast.success("Ученик добавлен");
      setNewName("");
      setNewPrice((defaultPrice / 100).toString());
      setAdding(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function removeStudent(studentId: string, name: string) {
    if (!confirm(`Убрать ${name} с этого занятия?`)) return;
    await onMutate({ action: "remove", slot_id: slot.id, student_id: studentId });
    toast.success("Ученик убран");
  }

  async function deleteSlot() {
    if (slot.payers.length > 0 && !confirm("Удалить занятие вместе с учениками?")) return;
    await onMutate({ action: "slot_delete", slot_id: slot.id });
    toast.success("Занятие удалено");
  }

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
        <div className="flex items-center">
          <button
            onClick={() => setAdding((v) => !v)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-primary"
            title="Добавить ученика"
          >
            <Plus className="size-3.5" />
          </button>
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
          <button
            onClick={deleteSlot}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-red-600"
            title="Удалить занятие"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>

      {slot.skipped ? (
        <span className="text-xs text-amber-600">урока не было</span>
      ) : slot.payers.length === 0 && !adding ? (
        <span className="text-xs text-muted-foreground">нет учеников</span>
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
            <button
              onClick={() => removeStudent(p.student_id, p.name)}
              className="rounded p-0.5 text-muted-foreground transition-colors hover:text-red-600"
              title="Убрать ученика"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))
      )}

      {adding && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg bg-muted/50 p-1.5">
          <Input
            list={`money-students-${slot.id}`}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addStudent()}
            placeholder="Имя ученика"
            className="h-8 flex-1 min-w-28"
            autoFocus
          />
          <datalist id={`money-students-${slot.id}`}>
            {suggestions.map((s) => (
              <option key={s.id} value={s.name} />
            ))}
          </datalist>
          <Input
            value={newPrice}
            onChange={(e) => setNewPrice(e.target.value)}
            inputMode="decimal"
            className="h-8 w-16"
            title="Цена, ₽"
          />
          <span className="text-xs text-muted-foreground">₽</span>
          <Button size="icon-sm" onClick={addStudent} title="Добавить">
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
