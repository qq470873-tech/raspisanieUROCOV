"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { apiPost, apiSend } from "@/lib/client";
import {
  STATUS_LABELS,
  WEEKDAYS,
  formatRange,
  weekdayLong,
  type BookingStatus,
  type Slot,
} from "@/lib/domain";
import type { BookingWithSlot } from "@/lib/queries";
import { AutoRefresh } from "@/components/auto-refresh";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EnglishQuiz } from "./english-quiz";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Child = { id: string; name: string };

const STATUS_STYLE: Record<BookingStatus, string> = {
  pending: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  confirmed: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  rejected: "bg-red-100 text-red-900 dark:bg-red-950/50 dark:text-red-200",
  proposed: "bg-sky-100 text-sky-900 dark:bg-sky-950/50 dark:text-sky-200",
  cancelled: "bg-muted text-muted-foreground",
};

export function StudentApp({
  token,
  students,
  slots,
  bookings,
}: {
  token: string;
  students: Child[];
  slots: Slot[];
  bookings: BookingWithSlot[];
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<{ slot: Slot; childId: string | null } | null>(null);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);

  const myIds = new Set(students.map((s) => s.id));
  const isMyPrimary = (b: BookingWithSlot) => !!b.student_id && myIds.has(b.student_id);

  // Подпись заявки: основная запись ребёнка или роль партнёра в парном занятии.
  function bookingLabel(b: BookingWithSlot): string {
    if (isMyPrimary(b)) {
      return b.student_2 ? `${b.student_1} + ${b.student_2} (пара)` : b.student_1;
    }
    // Мой ребёнок — партнёр по парному занятию.
    const mine = students.find((s) => s.id === b.partner_student_id);
    return `${mine?.name ?? "Ваш ребёнок"} · парное с ${b.student_1}`;
  }

  const activeCount = bookings.filter((b) =>
    ["pending", "confirmed", "proposed"].includes(b.status),
  ).length;

  const byDay = useMemo(() => {
    return WEEKDAYS.map((d) => ({
      ...d,
      slots: slots.filter((s) => s.weekday === d.value),
    })).filter((d) => d.slots.length > 0);
  }, [slots]);

  function openSlot(slot: Slot) {
    setDialog({ slot, childId: students.length === 1 ? students[0].id : null });
    setComment("");
  }

  async function book(childId: string) {
    if (!dialog) return;
    setBusy(true);
    try {
      await apiPost("/api/bookings", {
        token,
        slot_id: dialog.slot.id,
        student_id: childId,
        comment,
      });
      setDialog(null);
      toast.success("Заявка отправлена ✅");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function respond(accessToken: string, accept: boolean) {
    setBusy(true);
    try {
      await apiPost("/api/proposal", { access_token: accessToken, accept });
      toast.success(accept ? "Время принято" : "Предложение отклонено");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function changeIdentity() {
    await apiSend("/api/student/logout", "POST").catch(() => {});
    router.refresh();
  }

  return (
    <>
      <AutoRefresh seconds={12} />

      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Вы: <span className="font-medium text-foreground">{students.map((s) => s.name).join(", ")}</span>
        </p>
        <button onClick={changeIdentity} className="text-xs text-muted-foreground hover:text-foreground">
          Это не вы? Сменить
        </button>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Расписание</TabsTrigger>
          <TabsTrigger value="mine" className="gap-2">
            Ваши заявки
            {activeCount > 0 && (
              <Badge variant="secondary" className="rounded-full px-1.5">
                {activeCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="quiz">🎮 Тренажёр</TabsTrigger>
        </TabsList>

        {/* Расписание */}
        <TabsContent value="schedule" className="mt-5">
          {byDay.length === 0 ? (
            <Card className="flex flex-col items-center gap-2 p-12 text-center">
              <span className="text-4xl">🗓️</span>
              <p className="font-medium">Сейчас нет свободного времени</p>
              <p className="text-sm text-muted-foreground">Загляните чуть позже — расписание обновляется.</p>
            </Card>
          ) : (
            <div className="flex flex-col gap-6">
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
        </TabsContent>

        {/* Ваши заявки */}
        <TabsContent value="mine" className="mt-5">
          {bookings.length === 0 ? (
            <Card className="p-10 text-center text-muted-foreground">
              У вас пока нет заявок. Выберите время на вкладке «Расписание».
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {bookings.map((b) => (
                <Card key={b.id} className="flex flex-col gap-2 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{bookingLabel(b)}</span>
                    <Badge className={STATUS_STYLE[b.status]}>{STATUS_LABELS[b.status]}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {b.status === "proposed" ? "Предложено: " : ""}
                    {weekdayLong(b.slot.weekday)}, {formatRange(b.slot.start_time, b.slot.end_time)}
                  </div>
                  {b.status === "proposed" && isMyPrimary(b) && (
                    <div className="mt-1 flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => respond(b.access_token, true)} className="gap-1">
                        <Check className="size-4" /> Принять
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => respond(b.access_token, false)}
                        className="gap-1"
                      >
                        <X className="size-4" /> Отклонить
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="quiz" className="mt-5">
          <EnglishQuiz students={students} />
        </TabsContent>
      </Tabs>

      {/* Диалог записи */}
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

          {dialog && dialog.childId === null ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium">Кого записать на это время?</p>
              {students.map((c) => (
                <Button
                  key={c.id}
                  variant="outline"
                  className="justify-start"
                  onClick={() => setDialog({ ...dialog, childId: c.id })}
                >
                  {c.name}
                </Button>
              ))}
            </div>
          ) : (
            dialog && (
              <>
                <div className="flex flex-col gap-3">
                  <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                    Записываем:{" "}
                    <span className="font-medium">
                      {students.find((c) => c.id === dialog.childId)?.name}
                    </span>
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
                  <Button onClick={() => book(dialog.childId!)} disabled={busy}>
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
