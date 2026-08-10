"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Check, X, Trophy, RotateCcw } from "lucide-react";
import { apiPost } from "@/lib/client";
import { QUIZ_LEVELS, type QuizLevel } from "@/lib/quiz";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Child = { id: string; name: string };
type Stage = "child" | "level" | "play" | "done";

export function EnglishQuiz({ students }: { students: Child[] }) {
  const [stage, setStage] = useState<Stage>(students.length > 1 ? "child" : "level");
  const [childId, setChildId] = useState<string | null>(students.length === 1 ? students[0].id : null);
  const [level, setLevel] = useState<QuizLevel | null>(null);
  const [qi, setQi] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState(0);

  function reset() {
    setStage(students.length > 1 ? "child" : "level");
    if (students.length !== 1) setChildId(null);
    setLevel(null);
    setQi(0);
    setChosen(null);
    setScore(0);
  }

  function pick(idx: number) {
    if (chosen !== null || !level) return;
    setChosen(idx);
    const correct = idx === level.questions[qi].answer;
    if (correct) setScore((s) => s + 1);
  }

  async function next() {
    if (!level) return;
    if (qi + 1 < level.questions.length) {
      setQi((n) => n + 1);
      setChosen(null);
      return;
    }
    // конец — сохраняем результат
    setStage("done");
    if (childId) {
      try {
        await apiPost("/api/quiz", {
          student_id: childId,
          level: `${level.title} (${level.grades})`,
          score,
          total: level.questions.length,
        });
      } catch {
        /* результат не критичен для игры */
      }
    }
  }

  // Выбор ребёнка
  if (stage === "child") {
    return (
      <Wrap>
        <p className="mb-3 text-center font-medium">Кто играет?</p>
        <div className="flex flex-wrap justify-center gap-2">
          {students.map((c) => (
            <Button
              key={c.id}
              variant="outline"
              onClick={() => {
                setChildId(c.id);
                setStage("level");
              }}
            >
              {c.name}
            </Button>
          ))}
        </div>
      </Wrap>
    );
  }

  // Выбор уровня
  if (stage === "level") {
    return (
      <Wrap>
        <p className="mb-3 text-center font-medium">Выбери свой уровень</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {QUIZ_LEVELS.map((l) => (
            <button
              key={l.id}
              onClick={() => {
                setLevel(l);
                setQi(0);
                setChosen(null);
                setScore(0);
                setStage("play");
              }}
              className="rounded-xl border border-border bg-card p-4 text-center transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
            >
              <div className="text-base font-semibold">{l.title}</div>
              <div className="text-xs text-muted-foreground">{l.grades}</div>
            </button>
          ))}
        </div>
      </Wrap>
    );
  }

  // Результат
  if (stage === "done" && level) {
    const total = level.questions.length;
    const pct = Math.round((score / total) * 100);
    const emoji = pct >= 80 ? "🏆" : pct >= 50 ? "👍" : "💪";
    const msg = pct >= 80 ? "Отлично!" : pct >= 50 ? "Хорошо, продолжай!" : "Не сдавайся — попробуй ещё!";
    return (
      <Wrap>
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="text-5xl">{emoji}</span>
          <div className="text-xl font-bold">
            {score} из {total}
          </div>
          <p className="text-sm text-muted-foreground">{msg} Результат отправлен преподавателю.</p>
          <Button onClick={reset} className="mt-2 gap-1.5">
            <RotateCcw className="size-4" /> Играть ещё
          </Button>
        </div>
      </Wrap>
    );
  }

  // Игра
  if (stage === "play" && level) {
    const q = level.questions[qi];
    return (
      <Wrap>
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Вопрос {qi + 1} из {level.questions.length}
          </span>
          <span className="inline-flex items-center gap-1">
            <Trophy className="size-3.5" /> {score}
          </span>
        </div>
        <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-primary transition-all"
            style={{ width: `${((qi + (chosen !== null ? 1 : 0)) / level.questions.length) * 100}%` }}
          />
        </div>

        <p className="mb-4 text-center text-lg font-semibold">{q.q}</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {q.options.map((opt, idx) => {
            const isAnswer = idx === q.answer;
            const isChosen = idx === chosen;
            let cls = "border-border bg-card hover:bg-accent";
            if (chosen !== null) {
              if (isAnswer) cls = "border-emerald-400 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200";
              else if (isChosen) cls = "border-red-400 bg-red-50 text-red-900 dark:bg-red-950/50 dark:text-red-200";
              else cls = "border-border bg-card opacity-60";
            }
            return (
              <button
                key={idx}
                onClick={() => pick(idx)}
                disabled={chosen !== null}
                className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-3 text-left font-medium transition-colors ${cls}`}
              >
                <span>{opt}</span>
                {chosen !== null && isAnswer && <Check className="size-4 shrink-0" />}
                {chosen !== null && isChosen && !isAnswer && <X className="size-4 shrink-0" />}
              </button>
            );
          })}
        </div>

        {chosen !== null && (
          <div className="mt-4 flex justify-center">
            <Button onClick={next}>
              {qi + 1 < level.questions.length ? "Дальше →" : "Показать результат"}
            </Button>
          </div>
        )}
      </Wrap>
    );
  }

  return null;
}

function Wrap({ children }: { children: React.ReactNode }) {
  return <Card className="p-5 sm:p-6">{children}</Card>;
}
