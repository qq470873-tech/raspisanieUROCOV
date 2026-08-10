"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Combine, Pencil, Trophy, Users, X } from "lucide-react";
import { apiPost } from "@/lib/client";
import { STATUS_LABELS, formatRange, weekdayShort, type BookingStatus } from "@/lib/domain";
import type { StudentOverview } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const DOT: Record<BookingStatus, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-emerald-500",
  rejected: "bg-red-400",
  proposed: "bg-sky-400",
  cancelled: "bg-muted-foreground/40",
};

export function StudentsTab({ overview }: { overview: StudentOverview[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [mergeFor, setMergeFor] = useState<{ id: string; name: string } | null>(null);

  const households = useMemo(() => {
    const map = new Map<string, StudentOverview[]>();
    for (const s of overview) {
      const arr = map.get(s.household_id) ?? [];
      arr.push(s);
      map.set(s.household_id, arr);
    }
    return [...map.values()];
  }, [overview]);

  async function rename(id: string) {
    if (name.trim().length < 2) {
      toast.error("Укажите имя и фамилию");
      return;
    }
    try {
      await apiPost("/api/students/rename", { id, name: name.trim() });
      toast.success("Имя изменено");
      setEditing(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  if (overview.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Пока никто не зарегистрировался.
      </Card>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {households.map((members, i) => (
          <Card key={i} className="flex flex-col gap-3 p-4">
            {members.length > 1 && (
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Users className="size-3.5" /> Семья ({members.length})
              </div>
            )}
            {members.map((s) => (
              <div key={s.id} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  {editing === s.id ? (
                    <div className="flex flex-1 items-center gap-1">
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="h-8"
                        autoFocus
                      />
                      <Button size="icon-sm" onClick={() => rename(s.id)} title="Сохранить">
                        <Check className="size-4" />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() => setEditing(null)}
                        title="Отмена"
                      >
                        <X className="size-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <span className="font-medium">{s.name}</span>
                      <span className="flex items-center gap-0.5">
                        <button
                          onClick={() => {
                            setEditing(s.id);
                            setName(s.name);
                          }}
                          className="rounded p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                          title="Переименовать"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          onClick={() => setMergeFor({ id: s.id, name: s.name })}
                          className="rounded p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                          title="Объединить дубль"
                        >
                          <Combine className="size-3.5" />
                        </button>
                      </span>
                    </>
                  )}
                </div>

                {s.lastQuiz && (
                  <div className="flex items-center gap-1 text-xs text-violet-600 dark:text-violet-300">
                    <Trophy className="size-3" /> Тренажёр: {s.lastQuiz.score}/{s.lastQuiz.total} ·{" "}
                    {s.lastQuiz.level}
                  </div>
                )}

                {s.bookings.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Нет активных записей</p>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {s.bookings.map((b, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm">
                        <span className={`size-2 shrink-0 rounded-full ${DOT[b.status]}`} />
                        <span className="tabular-nums">
                          {weekdayShort(b.weekday)} {formatRange(b.start_time, b.end_time)}
                        </span>
                        {b.asPartner && (
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            пара
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{STATUS_LABELS[b.status]}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </Card>
        ))}
      </div>

      <MergeDialog
        source={mergeFor}
        all={overview}
        onClose={() => setMergeFor(null)}
        onDone={() => {
          setMergeFor(null);
          router.refresh();
        }}
      />
    </>
  );
}

function MergeDialog({
  source,
  all,
  onClose,
  onDone,
}: {
  source: { id: string; name: string } | null;
  all: StudentOverview[];
  onClose: () => void;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const open = source !== null;
  const targets = all.filter((s) => s.id !== source?.id);

  async function merge(targetId: string, targetName: string) {
    if (!source) return;
    if (!confirm(`Объединить «${source.name}» → «${targetName}»? Записи перейдут, дубль удалится.`))
      return;
    setBusy(true);
    try {
      await apiPost("/api/students/merge", { source_id: source.id, target_id: targetId });
      toast.success("Ученики объединены");
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
          <DialogTitle>Объединить дубль</DialogTitle>
          <DialogDescription>
            «{source?.name}» — это тот же ученик, что и кто-то ниже? Выберите, с кем объединить.
            Все записи и результаты перейдут к выбранному, а дубль удалится.
          </DialogDescription>
        </DialogHeader>
        {targets.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Нет других учеников.</p>
        ) : (
          <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
            {targets.map((t) => (
              <Button
                key={t.id}
                variant="outline"
                disabled={busy}
                className="justify-start"
                onClick={() => merge(t.id, t.name)}
              >
                {t.name}
              </Button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
