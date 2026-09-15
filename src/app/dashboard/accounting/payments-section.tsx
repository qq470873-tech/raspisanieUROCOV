"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import { apiPost } from "@/lib/client";
import { cn } from "@/lib/utils";
import { formatMoney, todayNN } from "@/lib/time-nn";
import type { PaymentsStudent } from "@/lib/accounting";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const toKop = (rub: string) => Math.round(parseFloat(rub.replace(",", ".")) * 100 || 0);

export function PaymentsSection() {
  const [students, setStudents] = useState<PaymentsStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function load() {
    try {
      const res = await fetch("/api/accounting/payment");
      if (!res.ok) throw new Error("Не удалось загрузить");
      const data = await res.json();
      setStudents(data.students);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function mutate(body: Record<string, unknown>) {
    await apiPost("/api/accounting/payment", body);
    await load();
  }

  const filtered = useMemo(
    () => students.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())),
    [students, q],
  );
  const selected = students.find((s) => s.studentId === selectedId) ?? null;

  if (loading) return <Card className="p-8 text-center text-muted-foreground">Загрузка…</Card>;

  if (students.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Пока нет учеников с назначенной ценой. Задайте стоимость во вкладке «Настройка стоимости».
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,300px)_1fr]">
      {/* Список учеников */}
      <Card className="flex max-h-[70vh] flex-col gap-2 p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск ученика…" className="h-9" />
        <div className="flex flex-col gap-1 overflow-y-auto">
          {filtered.map((s) => {
            const debt = s.balanceKopecks < 0;
            return (
              <button
                key={s.studentId}
                onClick={() => setSelectedId(s.studentId)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                  s.studentId === selectedId ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
              >
                <span className="truncate">{s.name}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                    s.studentId === selectedId
                      ? "bg-primary-foreground/20"
                      : debt
                        ? "bg-red-500/15 text-red-600 dark:text-red-300"
                        : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
                  )}
                >
                  {formatMoney(s.balanceKopecks)}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* Детали ученика */}
      {selected ? (
        <StudentDetail student={selected} onMutate={mutate} />
      ) : (
        <Card className="flex items-center justify-center p-10 text-center text-muted-foreground">
          Выберите ученика слева, чтобы увидеть баланс и платежи.
        </Card>
      )}
    </div>
  );
}

function StudentDetail({
  student,
  onMutate,
}: {
  student: PaymentsStudent;
  onMutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const debt = student.balanceKopecks < 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Баланс */}
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{student.name}</h3>
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-sm font-semibold tabular-nums",
              debt
                ? "bg-red-500/15 text-red-600 dark:text-red-300"
                : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
            )}
          >
            {debt ? "Долг " : "Остаток "}
            {formatMoney(Math.abs(student.balanceKopecks))}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Stat label="Оплачено" value={formatMoney(student.creditedKopecks)} />
          <Stat label="Списано" value={formatMoney(student.consumedKopecks)} />
          <Stat
            label="Осталось занятий"
            value={student.lessonsLeft === null ? "—" : String(student.lessonsLeft)}
          />
          <Stat label="Цена занятия" value={student.perLessonKopecks ? formatMoney(student.perLessonKopecks) : "—"} />
        </div>
      </Card>

      <AddPayment student={student} onMutate={onMutate} />

      {/* История платежей */}
      <Card className="flex flex-col gap-2 p-4">
        <h4 className="text-sm font-semibold">История платежей</h4>
        {student.payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">Платежей пока нет.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {student.payments.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <div className="min-w-0">
                  <span className="tabular-nums">{p.paid_at}</span>
                  {p.note && <span className="ml-2 text-muted-foreground">· {p.note}</span>}
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "font-medium tabular-nums",
                      p.amount_kopecks < 0 ? "text-red-500" : "text-emerald-600 dark:text-emerald-300",
                    )}
                  >
                    {p.amount_kopecks < 0 ? "" : "+"}
                    {formatMoney(p.amount_kopecks)}
                  </span>
                  <button
                    onClick={() => onMutate({ action: "delete", payment_id: p.id })}
                    className="rounded p-1 text-muted-foreground hover:bg-foreground/10 hover:text-red-500"
                    title="Удалить платёж"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Settings student={student} onMutate={onMutate} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function AddPayment({
  student,
  onMutate,
}: {
  student: PaymentsStudent;
  onMutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [mode, setMode] = useState<"money" | "lessons">("money");
  const [rub, setRub] = useState("");
  const [lessons, setLessons] = useState("");
  const [date, setDate] = useState(todayNN());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const per = student.perLessonKopecks;
  const computedKop =
    mode === "money" ? toKop(rub) : Math.round((parseFloat(lessons.replace(",", ".")) || 0) * per);

  async function add() {
    if (computedKop <= 0) {
      toast.error("Укажите сумму");
      return;
    }
    setBusy(true);
    try {
      await onMutate({
        action: "add",
        student_id: student.studentId,
        amount_kopecks: computedKop,
        paid_at: date,
        note: note.trim() || (mode === "lessons" ? `Оплата ${lessons} занятий` : ""),
      });
      setRub("");
      setLessons("");
      setNote("");
      toast.success("Платёж добавлен");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex flex-col gap-3 border-primary/20 bg-primary/5 p-4">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold">
        <Plus className="size-4 text-primary" /> Новый платёж
      </h4>

      <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
        <button
          onClick={() => setMode("money")}
          className={cn("flex-1 rounded-md px-3 py-1.5", mode === "money" && "bg-background shadow-sm")}
        >
          Сумма ₽
        </button>
        <button
          onClick={() => setMode("lessons")}
          disabled={!per}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 disabled:opacity-40",
            mode === "lessons" && "bg-background shadow-sm",
          )}
        >
          Кол-во занятий
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {mode === "money" ? (
          <Field label="Сумма, ₽">
            <Input value={rub} onChange={(e) => setRub(e.target.value)} inputMode="decimal" className="w-32" placeholder="6000" />
          </Field>
        ) : (
          <Field label="Занятий">
            <Input value={lessons} onChange={(e) => setLessons(e.target.value)} inputMode="numeric" className="w-24" placeholder="6" />
          </Field>
        )}
        <Field label="Дата оплаты">
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-40" />
        </Field>
        <Field label="Заметка (необязательно)">
          <Input value={note} onChange={(e) => setNote(e.target.value)} className="w-44" placeholder="напр. наличные" />
        </Field>
        <Button onClick={add} disabled={busy}>
          Добавить {computedKop > 0 ? `(${formatMoney(computedKop)})` : ""}
        </Button>
      </div>
      {mode === "lessons" && per > 0 && (
        <p className="text-xs text-muted-foreground">
          {lessons || 0} × {formatMoney(per)} = {formatMoney(computedKop)}
        </p>
      )}
    </Card>
  );
}

function Settings({
  student,
  onMutate,
}: {
  student: PaymentsStudent;
  onMutate: (body: Record<string, unknown>) => Promise<void>;
}) {
  const [anchor, setAnchor] = useState(student.anchorDate);
  const [balance, setBalance] = useState("");

  return (
    <Card className="flex flex-col gap-3 p-4">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold">
        <CalendarClock className="size-4 text-muted-foreground" /> Настройки ученика
      </h4>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Начало отсчёта">
          <Input type="date" value={anchor} onChange={(e) => setAnchor(e.target.value)} className="w-40" />
        </Field>
        <Button
          variant="outline"
          size="sm"
          disabled={anchor === student.anchorDate}
          onClick={async () => {
            await onMutate({ action: "anchor", student_id: student.studentId, date: anchor });
            toast.success("Дата отсчёта обновлена");
          }}
        >
          Сохранить дату
        </Button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Выставить остаток вручную, ₽">
          <Input value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" className="w-36" placeholder="напр. 3000" />
        </Field>
        <Button
          variant="outline"
          size="sm"
          disabled={!balance.trim()}
          onClick={async () => {
            await onMutate({ action: "setBalance", student_id: student.studentId, target_kopecks: toKop(balance) });
            setBalance("");
            toast.success("Остаток выставлен");
          }}
        >
          Применить
        </Button>
      </div>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  );
}
