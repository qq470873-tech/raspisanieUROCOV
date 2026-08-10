"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Check, Plus, X } from "lucide-react";
import { apiPost } from "@/lib/client";
import { WEEKDAYS, formatRange, weekdayLong, type Slot } from "@/lib/domain";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Booked = { name: string; slot: Slot; token: string };

export function BookingClient({ token, slots }: { token: string; slots: Slot[] }) {
  // Этап регистрации: имя(-ена) ученика(-ов).
  const [stage, setStage] = useState<"register" | "book">("register");
  const [child1, setChild1] = useState("");
  const [child2, setChild2] = useState("");
  const [hasSecond, setHasSecond] = useState(false);
  const [email, setEmail] = useState("");

  // Этап записи.
  const [children, setChildren] = useState<string[]>([]);
  const [available, setAvailable] = useState<Slot[]>(slots);
  const [booked, setBooked] = useState<Record<number, Booked>>({});
  const [dialog, setDialog] = useState<{ slot: Slot; childIndex: number | null } | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const byDay = useMemo(() => {
    return WEEKDAYS.map((d) => ({
      ...d,
      slots: available.filter((s) => s.weekday === d.value),
    })).filter((d) => d.slots.length > 0);
  }, [available]);

  const unbooked = children.map((_, i) => i).filter((i) => !booked[i]);
  const allBooked = children.length > 0 && unbooked.length === 0;

  function startBooking() {
    const c1 = child1.trim();
    if (c1.length < 2) {
      toast.error("Укажите имя и фамилию ученика");
      return;
    }
    const list = [c1];
    if (hasSecond) {
      const c2 = child2.trim();
      if (c2.length < 2) {
        toast.error("Укажите имя и фамилию второго ребёнка");
        return;
      }
      list.push(c2);
    }
    setChildren(list);
    setStage("book");
  }

  function openSlot(slot: Slot) {
    if (unbooked.length === 0) return;
    // Если остался один незаписанный ребёнок — выбираем его сразу.
    setDialog({ slot, childIndex: unbooked.length === 1 ? unbooked[0] : null });
    setComment("");
  }

  async function submit(childIndex: number) {
    if (!dialog) return;
    setBusy(true);
    try {
      const res = await apiPost<{ access_token: string }>("/api/bookings", {
        token,
        slot_id: dialog.slot.id,
        student_1: children[childIndex],
        comment,
        email,
      });
      setBooked((b) => ({
        ...b,
        [childIndex]: { name: children[childIndex], slot: dialog.slot, token: res.access_token },
      }));
      setAvailable((a) => a.filter((s) => s.id !== dialog.slot.id));
      setDialog(null);
      toast.success(`${children[childIndex]} записан(а) ✅`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  // ── Нет свободного времени вообще ──────────────────────────────────────────
  if (slots.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 p-12 text-center">
        <span className="text-4xl">🗓️</span>
        <p className="font-medium">Сейчас нет свободного времени</p>
        <p className="text-sm text-muted-foreground">Загляните чуть позже — расписание обновляется.</p>
      </Card>
    );
  }

  // ── Этап 1: регистрация ────────────────────────────────────────────────────
  if (stage === "register") {
    return (
      <Card className="mx-auto w-full max-w-md p-6 shadow-lg shadow-primary/5">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="child1">Имя и фамилия ученика *</Label>
            <Input
              id="child1"
              value={child1}
              onChange={(e) => setChild1(e.target.value)}
              placeholder="Например: Вася Иванов"
              autoFocus
            />
          </div>

          {hasSecond ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="child2">Второй ребёнок *</Label>
                <button
                  type="button"
                  onClick={() => {
                    setHasSecond(false);
                    setChild2("");
                  }}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" /> убрать
                </button>
              </div>
              <Input
                id="child2"
                value={child2}
                onChange={(e) => setChild2(e.target.value)}
                placeholder="Имя и фамилия"
              />
              <p className="text-xs text-muted-foreground">
                Каждому ребёнку выберете своё время на следующем шаге.
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setHasSecond(true)}
              className="flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
            >
              <Plus className="size-4" /> Добавить второго ребёнка
            </button>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email для уведомлений</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Необязательно — сообщим о решении"
            />
          </div>

          <Button size="lg" className="mt-1 h-11 text-base" onClick={startBooking}>
            Выбрать время →
          </Button>
        </div>
      </Card>
    );
  }

  // ── Этап 2: запись ─────────────────────────────────────────────────────────
  return (
    <>
      {/* Кого записываем */}
      {children.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {children.map((name, i) => (
            <span
              key={i}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium ${
                booked[i]
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200"
                  : "bg-accent text-accent-foreground"
              }`}
            >
              {booked[i] ? <Check className="size-3.5" /> : null}
              {name}
              {booked[i] && (
                <span className="opacity-80">
                  · {weekdayLong(booked[i].slot.weekday)} {formatRange(booked[i].slot.start_time, booked[i].slot.end_time)}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {allBooked ? (
        <Card className="flex flex-col gap-4 p-6 text-center shadow-lg shadow-primary/5">
          <span className="text-4xl">🎉</span>
          <div>
            <p className="text-lg font-semibold">
              {children.length > 1 ? "Все записаны!" : "Готово, вы записаны!"}
            </p>
            <p className="text-sm text-muted-foreground">
              Заявка отправлена преподавателю. Сохраните ссылки, чтобы следить за статусом.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {Object.values(booked).map((b) => (
              <a
                key={b.token}
                href={`/booking/${b.token}`}
                className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <span className="font-medium">{b.name}</span>
                <span className="text-sm tabular-nums text-muted-foreground">
                  {weekdayLong(b.slot.weekday)}, {formatRange(b.slot.start_time, b.slot.end_time)} →
                </span>
              </a>
            ))}
          </div>
        </Card>
      ) : available.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          Свободного времени больше не осталось.
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          {unbooked.length > 1 && (
            <p className="text-sm text-muted-foreground">
              Выберите время — потом укажете, кому из детей оно.
            </p>
          )}
          {byDay.map((day) => (
            <div key={day.value}>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-accent text-xs font-bold text-accent-foreground">
                  {day.short}
                </span>
                {day.long}
              </h2>
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                {day.slots.map((slot) => (
                  <button
                    key={slot.id}
                    onClick={() => openSlot(slot)}
                    className="group flex items-center justify-center gap-1.5 rounded-xl border border-border bg-card px-3 py-3.5 text-base font-semibold tabular-nums shadow-sm ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent hover:text-accent-foreground hover:shadow-md active:translate-y-0"
                  >
                    {formatRange(slot.start_time, slot.end_time)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Диалог подтверждения записи на слот */}
      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Запись на занятие</DialogTitle>
            {dialog && (
              <DialogDescription>
                {weekdayLong(dialog.slot.weekday)}, {formatRange(dialog.slot.start_time, dialog.slot.end_time)}
              </DialogDescription>
            )}
          </DialogHeader>

          {dialog && dialog.childIndex === null ? (
            // Нужно выбрать, кого записываем.
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Кого записать на это время?</p>
              {unbooked.map((i) => (
                <Button
                  key={i}
                  variant="outline"
                  className="justify-start"
                  onClick={() => setDialog({ ...dialog, childIndex: i })}
                >
                  {children[i]}
                </Button>
              ))}
            </div>
          ) : (
            dialog && (
              <>
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    Записываем: <span className="font-medium">{children[dialog.childIndex!]}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="comment">Комментарий</Label>
                    <Textarea
                      id="comment"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Необязательно"
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setDialog(null)} disabled={busy}>
                    Отмена
                  </Button>
                  <Button onClick={() => submit(dialog.childIndex!)} disabled={busy}>
                    {busy ? "Отправка…" : "Записаться"}
                  </Button>
                </DialogFooter>
              </>
            )
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
