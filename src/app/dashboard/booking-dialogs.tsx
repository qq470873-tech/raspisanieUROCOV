"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { apiPost } from "@/lib/client";
import { WEEKDAYS, formatRange, formatTime, weekdayLong, type Slot } from "@/lib/domain";
import type { BookingWithSlot } from "@/lib/queries";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type StudentOption = { id: string; name: string };

export function bookingNames(b: BookingWithSlot) {
  return [b.student_1, b.student_2, b.student_3].filter(Boolean).join(" + ");
}

export function ManualDialog({
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
    const studentPart =
      name.trim().length >= 2 ? { name: name.trim() } : studentId ? { student_id: studentId } : null;
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
          <DialogTitle>Добавить запись</DialogTitle>
          <DialogDescription>Запись сразу подтверждается.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label className="text-xs">Ученик</Label>
          {students.length > 0 && (
            <div className="flex max-h-32 flex-wrap gap-2 overflow-y-auto">
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

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs">Время</Label>
            <button onClick={() => setUseCustom((v) => !v)} className="text-xs text-primary hover:underline">
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
                    slotId === s.id ? "border-primary bg-primary/10" : "border-border hover:bg-accent"
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

export function PairDialog({
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

  const current = new Set(
    [booking?.student_id, booking?.partner_student_id, booking?.partner2_student_id].filter(
      Boolean,
    ) as string[],
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
              `${bookingNames(booking)} · ${weekdayLong(booking.slot.weekday)}, ${formatRange(
                booking.slot.start_time,
                booking.slot.end_time,
              )}`}
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

export function MoveDialog({
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
      const data = (await res.json().catch(() => ({}))) as { error?: string; conflicts?: string[] };
      if (res.ok) {
        toast.success("Перенесено");
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
                <span className="font-medium text-foreground">{warn.conflicts.join(", ")}</span>. Всё
                равно продолжить?
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
              <DialogTitle>Перенести на другое время</DialogTitle>
              <DialogDescription>Занятие переедет на выбранное время.</DialogDescription>
            </DialogHeader>

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
                  <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} className="w-28" />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Конец</Label>
                  <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className="w-28" />
                </div>
                <Button disabled={busy} onClick={submitCustom}>
                  Перенести
                </Button>
              </div>
            </div>

            {freeSlots.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-medium">Или выбрать из свободных</p>
                <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto py-1">
                  {freeSlots.map((s) => (
                    <Button
                      key={s.id}
                      variant="outline"
                      disabled={busy}
                      onClick={() => run({ ...base(), target_slot_id: s.id })}
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
