"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Plus, Trash2 } from "lucide-react";
import { apiPost, apiSend } from "@/lib/client";
import {
  WEEKDAYS,
  formatRange,
  formatTime,
  type SlotWithBooking,
} from "@/lib/domain";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const STATUS_STYLE: Record<string, string> = {
  free: "border-border bg-background",
  pending: "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  confirmed:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  proposed: "border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
};

function statusKey(slot: SlotWithBooking): keyof typeof STATUS_STYLE {
  if (!slot.booking) return "free";
  return slot.booking.status as keyof typeof STATUS_STYLE;
}

export function ScheduleTab({ slots }: { slots: SlotWithBooking[] }) {
  const router = useRouter();
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [busy, setBusy] = useState(false);

  const byDay = (wd: number) => slots.filter((s) => s.weekday === wd);

  async function addSlot() {
    if (end <= start) {
      toast.error("Конец должен быть позже начала");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/slots", {
        slots: [{ weekday: Number(weekday), start_time: start, end_time: end }],
      });
      toast.success("Слот добавлен");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function removeSlot(slot: SlotWithBooking) {
    if (slot.booking) {
      if (!confirm("В слоте есть заявка. Удалить слот вместе с ней?")) return;
    }
    try {
      await apiSend(`/api/slots/${slot.id}`, "DELETE");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function copyDayToAll(wd: number) {
    const source = byDay(wd).map((s) => ({
      start: formatTime(s.start_time),
      end: formatTime(s.end_time),
    }));
    if (source.length === 0) return;

    const newSlots: { weekday: number; start_time: string; end_time: string }[] = [];
    for (const day of WEEKDAYS) {
      if (day.value === wd) continue;
      const existing = new Set(byDay(day.value).map((s) => formatTime(s.start_time)));
      for (const t of source) {
        if (!existing.has(t.start)) {
          newSlots.push({ weekday: day.value, start_time: t.start, end_time: t.end });
        }
      }
    }
    if (newSlots.length === 0) {
      toast.info("Во всех днях уже есть эти слоты");
      return;
    }
    try {
      await apiPost("/api/slots", { slots: newSlots });
      toast.success(`Скопировано в другие дни (${newSlots.length})`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Добавление слота */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">День</label>
          <Select value={weekday} onValueChange={(v) => v && setWeekday(v)}>
            <SelectTrigger className="w-40">
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
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Начало</label>
          <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-32" />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Конец</label>
          <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-32" />
        </div>
        <Button onClick={addSlot} disabled={busy} className="gap-2">
          <Plus className="size-4" />
          Добавить
        </Button>
      </Card>

      {/* Сетка недели */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {WEEKDAYS.map((day) => {
          const daySlots = byDay(day.value);
          return (
            <Card key={day.value} className="flex flex-col gap-2 p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{day.long}</h3>
                {daySlots.length > 0 && (
                  <button
                    onClick={() => copyDayToAll(day.value)}
                    title="Скопировать на все дни"
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="size-3" />
                    на все дни
                  </button>
                )}
              </div>

              {daySlots.length === 0 ? (
                <p className="text-sm text-muted-foreground">Нет слотов</p>
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {daySlots.map((slot) => (
                    <li
                      key={slot.id}
                      className={`group flex items-center justify-between rounded-md border px-2.5 py-1.5 text-sm ${STATUS_STYLE[statusKey(slot)]}`}
                    >
                      <span className="tabular-nums">
                        {formatRange(slot.start_time, slot.end_time)}
                      </span>
                      <span className="flex items-center gap-2">
                        {slot.booking && (
                          <span className="truncate text-xs">
                            {slot.booking.student_2
                              ? `${slot.booking.student_1} + ${slot.booking.student_2}`
                              : slot.booking.student_1}
                          </span>
                        )}
                        <button
                          onClick={() => removeSlot(slot)}
                          className="opacity-40 transition-opacity hover:opacity-100"
                          title="Удалить слот"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
