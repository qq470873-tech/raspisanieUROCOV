"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiPost } from "@/lib/client";
import { WEEKDAYS, formatRange, type Slot } from "@/lib/domain";
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

export function BookingClient({ token, slots }: { token: string; slots: Slot[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Slot | null>(null);
  const [student1, setStudent1] = useState("");
  const [student2, setStudent2] = useState("");
  const [comment, setComment] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const byDay = useMemo(() => {
    return WEEKDAYS.map((d) => ({
      ...d,
      slots: slots.filter((s) => s.weekday === d.value),
    })).filter((d) => d.slots.length > 0);
  }, [slots]);

  function open(slot: Slot) {
    setSelected(slot);
    setStudent1("");
    setStudent2("");
    setComment("");
    setEmail("");
  }

  async function submit() {
    if (!selected) return;
    if (student1.trim().length < 2) {
      toast.error("Укажите имя и фамилию ученика");
      return;
    }
    setBusy(true);
    try {
      const res = await apiPost<{ access_token: string }>("/api/bookings", {
        token,
        slot_id: selected.id,
        student_1: student1,
        student_2: student2,
        comment,
        email,
      });
      router.push(`/booking/${res.access_token}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }

  if (slots.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Сейчас нет свободного времени. Загляните позже.
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-5">
        {byDay.map((day) => (
          <div key={day.value}>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">{day.long}</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {day.slots.map((slot) => (
                <Button
                  key={slot.id}
                  variant="outline"
                  onClick={() => open(slot)}
                  className="tabular-nums"
                >
                  {formatRange(slot.start_time, slot.end_time)}
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Запись на занятие</DialogTitle>
            {selected && (
              <DialogDescription>
                {WEEKDAYS.find((d) => d.value === selected.weekday)?.long},{" "}
                {formatRange(selected.start_time, selected.end_time)}
              </DialogDescription>
            )}
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="student1">Имя и фамилия ученика *</Label>
              <Input
                id="student1"
                value={student1}
                onChange={(e) => setStudent1(e.target.value)}
                placeholder="Например: Вася Иванов"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="student2">Второй ученик (для парного занятия)</Label>
              <Input
                id="student2"
                value={student2}
                onChange={(e) => setStudent2(e.target.value)}
                placeholder="Необязательно"
              />
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
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelected(null)} disabled={busy}>
              Отмена
            </Button>
            <Button onClick={submit} disabled={busy}>
              {busy ? "Отправка…" : "Записаться"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
