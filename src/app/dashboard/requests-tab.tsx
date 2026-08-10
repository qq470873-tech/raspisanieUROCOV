"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, X, Trash2, CalendarClock, Plus, Unlock, UserMinus, Users } from "lucide-react";
import { apiPost } from "@/lib/client";
import {
  STATUS_LABELS,
  WEEKDAYS,
  formatRange,
  formatTime,
  timeToMinutes,
  weekdayLong,
  type BookingStatus,
  type Slot,
} from "@/lib/domain";
import type { BookingWithSlot } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const STATUS_VARIANT: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  confirmed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
  proposed: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  cancelled: "bg-muted text-muted-foreground",
};

function names(b: BookingWithSlot) {
  return [b.student_1, b.student_2, b.student_3].filter(Boolean).join(" + ");
}

type StudentOption = { id: string; name: string };

export function RequestsTab({
  bookings,
  freeSlots,
  students,
}: {
  bookings: BookingWithSlot[];
  freeSlots: Slot[];
  students: StudentOption[];
}) {
  const router = useRouter();
  const [moveFor, setMoveFor] = useState<{ booking: BookingWithSlot; mode: "move" | "propose" } | null>(
    null,
  );
  const [pairFor, setPairFor] = useState<BookingWithSlot | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [manualOpen, setManualOpen] = useState(false);

  async function act(booking_id: string, action: "confirm" | "reject" | "delete" | "cancel") {
    if (action === "delete" && !confirm("Удалить заявку безвозвратно?")) return;
    try {
      await apiPost("/api/bookings/action", { booking_id, action });
      toast.success("Готово");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function unpair(booking_id: string) {
    try {
      await apiPost("/api/bookings/unpair", { booking_id });
      toast.success("Участник убран");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  const active = bookings.filter((b) =>
    ["pending", "confirmed", "proposed"].includes(b.status),
  );
  const shown = active.filter(
    (b) =>
      selected.size === 0 ||
      (b.student_id != null && selected.has(b.student_id)) ||
      (b.partner_student_id != null && selected.has(b.partner_student_id)),
  );
  const byDay = WEEKDAYS.map((d) => ({
    ...d,
    items: shown
      .filter((b) => b.slot.weekday === d.value)
      .sort((a, b) => timeToMinutes(a.slot.start_time) - timeToMinutes(b.slot.start_time)),
  })).filter((d) => d.items.length > 0);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const chip = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm transition-colors ${
      on
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card hover:bg-accent hover:text-accent-foreground"
    }`;

  function renderBooking(b: BookingWithSlot) {
    return (
      <Card key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold tabular-nums tracking-tight">
              {formatRange(b.slot.start_time, b.slot.end_time)}
            </span>
            <Badge className={STATUS_VARIANT[b.status]}>{STATUS_LABELS[b.status]}</Badge>
          </div>
          <div className="text-sm font-medium">{names(b)}</div>
          {b.comment && <div className="text-sm text-muted-foreground">💬 {b.comment}</div>}
          {b.email && <div className="text-xs text-muted-foreground">{b.email}</div>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {b.status === "pending" && (
            <>
              <Button size="sm" onClick={() => act(b.id, "confirm")} className="gap-1">
                <Check className="size-4" /> Подтвердить
              </Button>
              <Button size="sm" variant="outline" onClick={() => act(b.id, "reject")} className="gap-1">
                <X className="size-4" /> Отклонить
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMoveFor({ booking: b, mode: "propose" })}
                className="gap-1"
              >
                <CalendarClock className="size-4" /> Предложить время
              </Button>
            </>
          )}
          {b.status === "confirmed" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMoveFor({ booking: b, mode: "move" })}
                className="gap-1"
              >
                <CalendarClock className="size-4" /> Перенести
              </Button>
              <Button size="sm" variant="outline" onClick={() => act(b.id, "cancel")} className="gap-1">
                <Unlock className="size-4" /> Освободить
              </Button>
            </>
          )}
          {(b.status === "pending" || b.status === "confirmed") && !b.partner2_student_id && (
            <Button size="sm" variant="outline" onClick={() => setPairFor(b)} className="gap-1">
              <Users className="size-4" />
              {b.partner_student_id ? "Добавить третьего" : "Сделать парным"}
            </Button>
          )}
          {b.partner_student_id && (
            <Button size="sm" variant="outline" onClick={() => unpair(b.id)} className="gap-1">
              <UserMinus className="size-4" /> Разъединить
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => act(b.id, "delete")}
            title="Удалить заявку"
            className="gap-1 text-muted-foreground"
          >
            <Trash2 className="size-4" /> Удалить
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        {students.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            <button className={chip(selected.size === 0)} onClick={() => setSelected(new Set())}>
              Все
            </button>
            {students.map((s) => (
              <button key={s.id} className={chip(selected.has(s.id))} onClick={() => toggle(s.id)}>
                {s.name}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <Button size="sm" onClick={() => setManualOpen(true)} className="gap-1">
          <Plus className="size-4" /> Добавить запись
        </Button>
      </div>

      {active.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Активных заявок нет. Поделитесь ссылкой с родителями.
        </Card>
      ) : byDay.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Нет заявок по выбранным ученикам.
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {byDay.map((day) => (
            <div key={day.value}>
              <h3 className="mb-2 text-sm font-semibold text-muted-foreground">{day.long}</h3>
              <div className="flex flex-col gap-3">{day.items.map(renderBooking)}</div>
            </div>
          ))}
        </div>
      )}

      <MoveDialog
        state={moveFor}
        freeSlots={freeSlots}
        onClose={() => setMoveFor(null)}
        onDone={() => {
          setMoveFor(null);
          router.refresh();
        }}
      />

      <PairDialog
        booking={pairFor}
        students={students}
        onClose={() => setPairFor(null)}
        onDone={() => {
          setPairFor(null);
          router.refresh();
        }}
      />

      <ManualDialog
        open={manualOpen}
        students={students}
        freeSlots={freeSlots}
        onClose={() => setManualOpen(false)}
        onDone={() => {
          setManualOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}

function ManualDialog({
  open,
  students,
  freeSlots,
  onClose,
  onDone,
}: {
  open: boolean;
  students: StudentOption[];
  freeSlots: Slot[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slotId, setSlotId] = useState<string | null>(null);
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("16:00");
  const [useCustom, setUseCustom] = useState(false);

  async function submit() {
    const studentPart = name.trim().length >= 2 ? { name: name.trim() } : studentId ? { student_id: studentId } : null;
    if (!studentPart) {
      toast.error("Выберите или впишите ученика");
      return;
    }
    let timePart: object | null = null;
    if (useCustom) {
      if (end <= start) {
        toast.error("Конец должен быть позже начала");
        return;
      }
      timePart = { custom_time: { weekday: Number(weekday), start_time: start, end_time: end } };
    } else if (slotId) {
      timePart = { slot_id: slotId };
    }
    if (!timePart) {
      toast.error("Выберите время");
      return;
    }
    setBusy(true);
    try {
      await apiPost("/api/bookings/manual", { ...studentPart, ...timePart });
      toast.success("Запись добавлена");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить запись вручную</DialogTitle>
          <DialogDescription>Для тех, кто написал или позвонил. Запись сразу подтверждается.</DialogDescription>
        </DialogHeader>

        {/* Ученик */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Ученик</Label>
          {students.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {students.map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setStudentId(s.id);
                    setName("");
                  }}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    studentId === s.id && !name
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value) setStudentId(null);
            }}
            placeholder="…или впишите нового ученика"
          />
        </div>

        {/* Время */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Время</Label>
            <button
              onClick={() => setUseCustom((v) => !v)}
              className="text-xs text-primary hover:underline"
            >
              {useCustom ? "выбрать из свободных" : "задать своё время"}
            </button>
          </div>

          {useCustom ? (
            <div className="flex flex-wrap items-end gap-2">
              <Select value={weekday} onValueChange={(v) => v && setWeekday(v)}>
                <SelectTrigger className="w-32">
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
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-28" />
            </div>
          ) : freeSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Свободных слотов нет — задайте своё время.</p>
          ) : (
            <div className="grid max-h-48 grid-cols-2 gap-2 overflow-y-auto">
              {freeSlots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSlotId(s.id)}
                  className={`flex flex-col items-start rounded-lg border px-2.5 py-1.5 text-sm ${
                    slotId === s.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-accent"
                  }`}
                >
                  <span className="text-xs text-muted-foreground">{weekdayLong(s.weekday)}</span>
                  <span className="tabular-nums">{formatRange(s.start_time, s.end_time)}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Отмена
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy ? "Добавление…" : "Добавить"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PairDialog({
  booking,
  students,
  onClose,
  onDone,
}: {
  booking: BookingWithSlot | null;
  students: StudentOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState("");
  const open = booking !== null;
  const isThird = !!booking?.partner_student_id;

  // Исключаем уже участвующих (основного и добавленных).
  const current = new Set(
    [booking?.student_id, booking?.partner_student_id, booking?.partner2_student_id].filter(Boolean) as string[],
  );
  const options = students.filter((s) => !current.has(s.id));

  async function pair(payload: { student_id?: string; name?: string }) {
    if (!booking) return;
    setBusy(true);
    try {
      await apiPost("/api/bookings/pair", { booking_id: booking.id, ...payload });
      toast.success(isThird ? "Третий ученик добавлен" : "Занятие стало парным");
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isThird ? "Третий ученик (тройка)" : "Второй ученик (пара)"}</DialogTitle>
          <DialogDescription>
            {booking &&
              `${names(booking)} · ${weekdayLong(booking.slot.weekday)}, ${formatRange(
                booking.slot.start_time,
                booking.slot.end_time,
              )}. Новый ученик получит уведомление.`}
          </DialogDescription>
        </DialogHeader>

        {options.length > 0 && (
          <div className="flex flex-col gap-2">
            <Label className="text-xs">Выбрать из учеников</Label>
            <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
              {options.map((s) => (
                <Button
                  key={s.id}
                  variant="outline"
                  disabled={busy}
                  className="justify-start"
                  onClick={() => pair({ student_id: s.id })}
                >
                  {s.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="manual" className="text-xs">
            Или вписать нового
          </Label>
          <div className="flex gap-2">
            <Input
              id="manual"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Имя и фамилия"
            />
            <Button disabled={busy || manual.trim().length < 2} onClick={() => pair({ name: manual.trim() })}>
              Добавить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type MovePayload = {
  booking_id: string;
  mode: "move" | "propose";
  target_slot_id?: string;
  custom_time?: { weekday: number; start_time: string; end_time: string };
  force?: boolean;
};

function MoveDialog({
  state,
  freeSlots,
  onClose,
  onDone,
}: {
  state: { booking: BookingWithSlot; mode: "move" | "propose" } | null;
  freeSlots: Slot[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [weekday, setWeekday] = useState("1");
  const [start, setStart] = useState("15:00");
  const [end, setEnd] = useState("16:00");
  const [warn, setWarn] = useState<{ conflicts: string[]; payload: MovePayload } | null>(null);
  const open = state !== null;
  const mode = state?.mode ?? "move";

  // При открытии подставляем текущее время заявки как отправную точку.
  useEffect(() => {
    if (!state) return;
    setWeekday(String(state.booking.slot.weekday));
    setStart(formatTime(state.booking.slot.start_time));
    setEnd(formatTime(state.booking.slot.end_time));
    setWarn(null);
  }, [state]);

  async function run(payload: MovePayload) {
    setBusy(true);
    try {
      const res = await fetch("/api/bookings/move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        conflicts?: string[];
      };
      if (res.ok) {
        toast.success(mode === "propose" ? "Предложение отправлено" : "Перенесено");
        onDone();
        return;
      }
      if (res.status === 409 && data.error === "overlap") {
        setWarn({ conflicts: data.conflicts ?? [], payload });
        return;
      }
      toast.error(data.error ?? "Ошибка");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  function base(): MovePayload {
    return { booking_id: state!.booking.id, mode: state!.mode };
  }

  function chooseSlot(slotId: string) {
    run({ ...base(), target_slot_id: slotId });
  }

  function submitCustom() {
    if (end <= start) {
      toast.error("Конец должен быть позже начала");
      return;
    }
    run({ ...base(), custom_time: { weekday: Number(weekday), start_time: start, end_time: end } });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        {warn ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-amber-600">
                <AlertTriangle className="size-5" /> Время пересекается
              </DialogTitle>
              <DialogDescription>
                В это время уже есть запись:{" "}
                <span className="font-medium text-foreground">{warn.conflicts.join(", ")}</span>.
                Всё равно продолжить?
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" disabled={busy} onClick={() => setWarn(null)}>
                Изменить время
              </Button>
              <Button disabled={busy} onClick={() => run({ ...warn.payload, force: true })}>
                Всё равно продолжить
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {mode === "propose" ? "Предложить другое время" : "Перенести на другое время"}
              </DialogTitle>
              <DialogDescription>
                {mode === "propose"
                  ? "Ученик получит предложение и сможет принять или отклонить его."
                  : "Заявка переедет на выбранное время."}
              </DialogDescription>
            </DialogHeader>

            {/* Ручной ввод времени */}
            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <p className="mb-2 text-sm font-medium">Задать своё время</p>
              <div className="flex flex-wrap items-end gap-2">
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">День</Label>
                  <Select value={weekday} onValueChange={(v) => v && setWeekday(v)}>
                    <SelectTrigger className="w-32">
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
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Начало</Label>
                  <Input
                    type="time"
                    value={start}
                    onChange={(e) => setStart(e.target.value)}
                    className="w-28"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Конец</Label>
                  <Input
                    type="time"
                    value={end}
                    onChange={(e) => setEnd(e.target.value)}
                    className="w-28"
                  />
                </div>
                <Button disabled={busy} onClick={submitCustom}>
                  {mode === "propose" ? "Предложить" : "Перенести"}
                </Button>
              </div>
            </div>

            {/* Быстрый выбор из свободных слотов */}
            {freeSlots.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Или выбрать из свободных</p>
                <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto py-1">
                  {freeSlots.map((s) => (
                    <Button
                      key={s.id}
                      variant="outline"
                      disabled={busy}
                      onClick={() => chooseSlot(s.id)}
                      className="h-auto flex-col items-start gap-0.5 py-2"
                    >
                      <span className="text-xs text-muted-foreground">{weekdayLong(s.weekday)}</span>
                      <span className="tabular-nums">{formatRange(s.start_time, s.end_time)}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
