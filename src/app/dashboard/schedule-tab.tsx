"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Copy,
  History,
  Plus,
  Printer,
  Trash2,
  Unlock,
  UserMinus,
  Users,
} from "lucide-react";
import { apiPost, apiSend } from "@/lib/client";
import {
  WEEKDAYS,
  formatRange,
  formatTime,
  shiftTime,
  timeToMinutes,
  weekdayLong,
  type Booking,
  type Slot,
  type SlotWithBooking,
} from "@/lib/domain";
import type { BookingEvent, BookingWithSlot } from "@/lib/queries";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { HistoryTab } from "./history-tab";
import { ManualDialog, MoveDialog, PairDialog, type StudentOption } from "./booking-dialogs";

const STATUS_STYLE: Record<string, string> = {
  free: "border-border bg-background",
  confirmed:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  proposed: "border-sky-300 bg-sky-50 text-sky-900 dark:bg-sky-950/40 dark:text-sky-200",
  pending: "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
};

function statusKey(slot: SlotWithBooking): keyof typeof STATUS_STYLE {
  if (slot.booking) return slot.booking.status as keyof typeof STATUS_STYLE;
  if (slot.pendingCount > 0) return "pending";
  return "free";
}

function bookingNames(b: Pick<Booking, "student_1" | "student_2" | "student_3">) {
  return [b.student_1, b.student_2, b.student_3].filter(Boolean).join(" + ");
}

export function ScheduleTab({
  slots,
  freeSlots,
  students,
  history,
}: {
  slots: SlotWithBooking[];
  freeSlots: Slot[];
  students: StudentOption[];
  history: BookingEvent[];
}) {
  const router = useRouter();
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [busy, setBusy] = useState(false);

  const [manualOpen, setManualOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [actionsFor, setActionsFor] = useState<BookingWithSlot | null>(null);
  const [moveFor, setMoveFor] = useState<{ booking: BookingWithSlot; mode: "move" } | null>(null);
  const [pairFor, setPairFor] = useState<BookingWithSlot | null>(null);

  const byDay = (wd: number) => slots.filter((s) => s.weekday === wd);
  const refresh = () => router.refresh();

  async function addSlot() {
    if (end <= start) return toast.error("Конец должен быть позже начала");
    setBusy(true);
    try {
      await apiPost("/api/slots", {
        slots: [{ weekday: Number(weekday), start_time: start, end_time: end }],
      });
      toast.success("Слот добавлен");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function shiftSlot(slot: SlotWithBooking, delta: number) {
    const newStart = shiftTime(slot.start_time, delta);
    const newEnd = shiftTime(slot.end_time, delta);
    const duration = timeToMinutes(slot.end_time) - timeToMinutes(slot.start_time);
    if (timeToMinutes(newEnd) - timeToMinutes(newStart) !== duration) {
      toast.info(delta < 0 ? "Уже начало суток" : "Уже конец суток");
      return;
    }
    try {
      await apiSend(`/api/slots/${slot.id}`, "PATCH", { start_time: newStart, end_time: newEnd });
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function removeSlot(slot: SlotWithBooking) {
    if (slot.booking && !confirm("В слоте есть запись. Удалить слот вместе с ней?")) return;
    try {
      await apiSend(`/api/slots/${slot.id}`, "DELETE");
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function copyDayToAll(wd: number) {
    const source = byDay(wd).map((s) => ({ start: formatTime(s.start_time), end: formatTime(s.end_time) }));
    if (source.length === 0) return;
    const newSlots: { weekday: number; start_time: string; end_time: string }[] = [];
    for (const day of WEEKDAYS) {
      if (day.value === wd) continue;
      const existing = new Set(byDay(day.value).map((s) => formatTime(s.start_time)));
      for (const t of source) {
        if (!existing.has(t.start)) newSlots.push({ weekday: day.value, start_time: t.start, end_time: t.end });
      }
    }
    if (newSlots.length === 0) return toast.info("Во всех днях уже есть эти слоты");
    try {
      await apiPost("/api/slots", { slots: newSlots });
      toast.success(`Скопировано (${newSlots.length})`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function bookingAction(id: string, action: "cancel" | "delete" | "unpair") {
    if (action === "delete" && !confirm("Удалить запись безвозвратно?")) return;
    try {
      if (action === "unpair") await apiPost("/api/bookings/unpair", { booking_id: id });
      else await apiPost("/api/bookings/action", { booking_id: id, action });
      toast.success("Готово");
      setActionsFor(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Тулбар */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setManualOpen(true)} className="gap-1.5">
            <Plus className="size-4" /> Добавить запись
          </Button>
          <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)} className="gap-1.5">
            <History className="size-4" /> История перемещений
          </Button>
        </div>
        <Link
          href="/dashboard/print"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent"
        >
          <Printer className="size-4" /> Печать недели
        </Link>
      </div>

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
          <Plus className="size-4" /> Добавить слот
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
                    <Copy className="size-3" /> на все дни
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
                      <span className="tabular-nums">{formatRange(slot.start_time, slot.end_time)}</span>
                      <span className="flex items-center gap-1.5">
                        {slot.booking ? (
                          <button
                            onClick={() => setActionsFor({ ...(slot.booking as Booking), slot })}
                            className="truncate text-xs underline-offset-2 hover:underline"
                            title="Действия с записью"
                          >
                            {bookingNames(slot.booking)}
                          </button>
                        ) : null}
                        <span className="flex items-center opacity-40 transition-opacity group-hover:opacity-100">
                          <button onClick={() => shiftSlot(slot, -30)} className="rounded p-0.5 hover:bg-foreground/10" title="Раньше на 30 мин">
                            <ChevronUp className="size-3.5" />
                          </button>
                          <button onClick={() => shiftSlot(slot, 30)} className="rounded p-0.5 hover:bg-foreground/10" title="Позже на 30 мин">
                            <ChevronDown className="size-3.5" />
                          </button>
                        </span>
                        <button onClick={() => removeSlot(slot)} className="opacity-40 transition-opacity hover:opacity-100" title="Удалить слот">
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

      {/* Действия с записью */}
      <Dialog open={actionsFor !== null} onOpenChange={(o) => !o && setActionsFor(null)}>
        <DialogContent>
          {actionsFor && (
            <>
              <DialogHeader>
                <DialogTitle>{bookingNames(actionsFor)}</DialogTitle>
                <DialogDescription>
                  {weekdayLong(actionsFor.slot.weekday)}, {formatRange(actionsFor.slot.start_time, actionsFor.slot.end_time)}
                </DialogDescription>
              </DialogHeader>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  variant="outline"
                  className="justify-start gap-2"
                  onClick={() => {
                    const b = actionsFor;
                    setActionsFor(null);
                    setMoveFor({ booking: b, mode: "move" });
                  }}
                >
                  <CalendarClock className="size-4" /> Перенести
                </Button>
                {!actionsFor.partner2_student_id && (
                  <Button
                    variant="outline"
                    className="justify-start gap-2"
                    onClick={() => {
                      const b = actionsFor;
                      setActionsFor(null);
                      setPairFor(b);
                    }}
                  >
                    <Users className="size-4" /> {actionsFor.partner_student_id ? "Добавить третьего" : "Сделать парным"}
                  </Button>
                )}
                {actionsFor.partner_student_id && (
                  <Button variant="outline" className="justify-start gap-2" onClick={() => bookingAction(actionsFor.id, "unpair")}>
                    <UserMinus className="size-4" /> Разъединить
                  </Button>
                )}
                <Button variant="outline" className="justify-start gap-2" onClick={() => bookingAction(actionsFor.id, "cancel")}>
                  <Unlock className="size-4" /> Освободить слот
                </Button>
                <Button variant="outline" className="justify-start gap-2 text-red-600" onClick={() => bookingAction(actionsFor.id, "delete")}>
                  <Trash2 className="size-4" /> Удалить запись
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* История перемещений */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>История перемещений</DialogTitle>
            <DialogDescription>Переносы, освобождения и изменения записей.</DialogDescription>
          </DialogHeader>
          <HistoryTab history={history} />
        </DialogContent>
      </Dialog>

      <ManualDialog
        open={manualOpen}
        students={students}
        freeSlots={freeSlots}
        onClose={() => setManualOpen(false)}
        onDone={() => {
          setManualOpen(false);
          refresh();
        }}
      />
      <MoveDialog
        state={moveFor}
        freeSlots={freeSlots}
        onClose={() => setMoveFor(null)}
        onDone={() => {
          setMoveFor(null);
          refresh();
        }}
      />
      <PairDialog
        booking={pairFor}
        students={students}
        onClose={() => setPairFor(null)}
        onDone={() => {
          setPairFor(null);
          refresh();
        }}
      />
    </div>
  );
}
