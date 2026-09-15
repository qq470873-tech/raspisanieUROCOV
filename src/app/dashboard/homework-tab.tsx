"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { BookOpen, Save, Trash2 } from "lucide-react";
import { apiPost } from "@/lib/client";
import { cn } from "@/lib/utils";
import { todayNN } from "@/lib/time-nn";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Student = { id: string; name: string };
type Entry = { id: string; date: string; text: string };

export function HomeworkTab() {
  const [students, setStudents] = useState<Student[]>([]);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/homework")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Ошибка загрузки"))))
      .then((d) => setStudents(d.students))
      .catch((e) => toast.error(e instanceof Error ? e.message : "Ошибка"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(
    () => students.filter((s) => s.name.toLowerCase().includes(q.trim().toLowerCase())),
    [students, q],
  );

  if (loading) return <Card className="p-8 text-center text-muted-foreground">Загрузка…</Card>;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(220px,300px)_1fr]">
      <Card className="flex max-h-[70vh] min-w-0 flex-col gap-2 p-3">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск ученика…" className="h-9" />
        <div className="flex min-w-0 flex-col gap-1 overflow-y-auto">
          {filtered.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelected(s)}
              className={cn(
                "flex min-w-0 items-center rounded-lg px-3 py-2 text-left text-sm transition-colors",
                selected?.id === s.id ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              <span className="truncate">{s.name}</span>
            </button>
          ))}
        </div>
      </Card>

      <div className="min-w-0">
        {selected ? (
          <StudentHomework student={selected} />
        ) : (
          <Card className="flex flex-col items-center justify-center gap-3 p-10 text-center text-muted-foreground">
            <BookOpen className="size-8" />
            Выберите ученика, чтобы записать домашнее задание.
          </Card>
        )}
      </div>
    </div>
  );
}

function StudentHomework({ student }: { student: Student }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [date, setDate] = useState(todayNN());
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    setText("");
    setDate(todayNN());
    fetch(`/api/homework?student=${student.id}`)
      .then((r) => (r.ok ? r.json() : { entries: [] }))
      .then((d) => setEntries(d.entries))
      .catch(() => {});
  }, [student.id, reload]);

  async function save() {
    if (!text.trim()) return toast.error("Впишите задание");
    setBusy(true);
    try {
      await apiPost("/api/homework", { action: "save", student_id: student.id, date, text });
      toast.success("Задание сохранено");
      setText("");
      setReload((r) => r + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    try {
      await apiPost("/api/homework", { action: "delete", id });
      setReload((r) => r + 1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card className="flex flex-col gap-3 p-4">
        <h3 className="text-base font-semibold">{student.name}</h3>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground">Дата занятия</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-44" />
        </div>
        <div className="flex flex-col gap-2">
          <label className="text-xs text-muted-foreground">Что задано</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Например: упражнения 3–5 стр. 42, выучить слова…"
            rows={4}
          />
        </div>
        <Button onClick={save} disabled={busy} className="gap-1.5 self-start">
          <Save className="size-4" /> Сохранить
        </Button>
      </Card>

      <Card className="flex flex-col gap-2 p-4">
        <h4 className="text-sm font-semibold">Заданные ДЗ</h4>
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Пока ничего не задано.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-xs font-medium tabular-nums text-muted-foreground">{e.date}</p>
                  <p className="whitespace-pre-wrap text-sm">{e.text}</p>
                </div>
                <button
                  onClick={() => remove(e.id)}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-foreground/10 hover:text-red-500"
                  title="Удалить"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
