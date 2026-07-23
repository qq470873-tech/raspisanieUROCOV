"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Trash2, CalendarClock, Unlock } from "lucide-react";
import { apiPost } from "@/lib/client";
import {
  STATUS_LABELS,
  formatRange,
  weekdayLong,
  type BookingStatus,
  type Slot,
} from "@/lib/domain";
import type { BookingWithSlot } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  return b.student_2 ? `${b.student_1} + ${b.student_2}` : b.student_1;
}

export function RequestsTab({
  bookings,
  freeSlots,
}: {
  bookings: BookingWithSlot[];
  freeSlots: Slot[];
}) {
  const router = useRouter();
  const [moveFor, setMoveFor] = useState<{ booking: BookingWithSlot; mode: "move" | "propose" } | null>(
    null,
  );

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

  if (bookings.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Заявок пока нет. Поделитесь ссылкой с родителями.
      </Card>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {bookings.map((b) => (
          <Card key={b.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{names(b)}</span>
                <Badge className={STATUS_VARIANT[b.status]}>{STATUS_LABELS[b.status]}</Badge>
              </div>
              <div className="text-sm text-muted-foreground">
                {weekdayLong(b.slot.weekday)}, {formatRange(b.slot.start_time, b.slot.end_time)}
              </div>
              {b.comment && <div className="text-sm">💬 {b.comment}</div>}
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
              <Button
                size="icon"
                variant="ghost"
                onClick={() => act(b.id, "delete")}
                title="Удалить"
                className="text-muted-foreground"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <MoveDialog
        state={moveFor}
        freeSlots={freeSlots}
        onClose={() => setMoveFor(null)}
        onDone={() => {
          setMoveFor(null);
          router.refresh();
        }}
      />
    </>
  );
}

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
  const open = state !== null;
  const mode = state?.mode ?? "move";

  async function choose(slotId: string) {
    if (!state) return;
    setBusy(true);
    try {
      await apiPost("/api/bookings/move", {
        booking_id: state.booking.id,
        target_slot_id: slotId,
        mode: state.mode,
      });
      toast.success(mode === "propose" ? "Предложение отправлено" : "Перенесено");
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
          <DialogTitle>
            {mode === "propose" ? "Предложить другое время" : "Перенести на другое время"}
          </DialogTitle>
          <DialogDescription>
            {mode === "propose"
              ? "Ученик получит предложение и сможет принять или отклонить его."
              : "Заявка сразу переедет в выбранный свободный слот."}
          </DialogDescription>
        </DialogHeader>

        {freeSlots.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Нет свободных слотов.</p>
        ) : (
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto py-1">
            {freeSlots.map((s) => (
              <Button
                key={s.id}
                variant="outline"
                disabled={busy}
                onClick={() => choose(s.id)}
                className="h-auto flex-col items-start gap-0.5 py-2"
              >
                <span className="text-xs text-muted-foreground">{weekdayLong(s.weekday)}</span>
                <span className="tabular-nums">{formatRange(s.start_time, s.end_time)}</span>
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
