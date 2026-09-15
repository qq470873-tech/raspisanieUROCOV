"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CalendarClock, Loader2, Send, Sparkles, Wallet } from "lucide-react";
import { apiPost } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Msg = { role: "user" | "model"; text: string };

const ASSISTANT_NAME = "Люси";

const WELCOME = `Здравствуйте, Анастасия! Меня зовут ${ASSISTANT_NAME} 🌸 — ваш личный ассистент.
Я вижу ваше расписание и оплаты учеников и помогу:
• найти несостыковки — пересечения занятий по времени, должников;
• посчитать балансы и долги;
• ответить на вопросы по ученикам и оплатам.
Нажмите кнопку быстрого действия ниже или просто напишите мне 💬`;

const QUICK_ACTIONS: { label: string; icon: typeof AlertTriangle; prompt: string }[] = [
  {
    label: "Проверить несостыковки",
    icon: AlertTriangle,
    prompt:
      "Проверь расписание и оплаты на несостыковки: пересечения занятий по времени в один день, учеников-должников, подозрительные цены. Кратко перечисли, что нашла.",
  },
  {
    label: "Кто в долгу",
    icon: Wallet,
    prompt:
      "Покажи всех учеников с долгом (отрицательный остаток) и сумму долга. Если долгов нет — так и скажи.",
  },
  {
    label: "Сводка недели",
    icon: CalendarClock,
    prompt:
      "Дай краткую сводку по расписанию на неделю: сколько занятий, в какие дни, есть ли свободные слоты.",
  },
];

export function AssistantTab() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: Msg[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await apiPost<{ reply: string }>("/api/assistant", { messages: next });
      setMessages((m) => [...m, { role: "model", text: res.reply }]);
    } catch (e) {
      setMessages((m) => [
        ...m,
        { role: "model", text: `⚠️ ${e instanceof Error ? e.message : "Ошибка"}` },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="flex h-[70vh] flex-col overflow-hidden p-0">
      {/* Заголовок */}
      <div className="flex items-center gap-3 border-b bg-primary/5 px-4 py-3">
        <span className="brand-badge size-9">
          <Sparkles className="size-5" />
        </span>
        <div>
          <p className="text-sm font-semibold leading-tight">{ASSISTANT_NAME}</p>
          <p className="text-xs text-muted-foreground">ИИ-ассистент · всегда на связи</p>
        </div>
      </div>

      {/* Лента сообщений */}
      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
        {/* Приветствие */}
        <Bubble role="model" text={WELCOME} />
        {messages.map((m, i) => (
          <Bubble key={i} role={m.role} text={m.text} />
        ))}
        {busy && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {ASSISTANT_NAME} печатает…
          </div>
        )}
      </div>

      {/* Быстрые действия */}
      {messages.length === 0 && (
        <div className="flex flex-wrap gap-2 border-t px-4 py-3">
          {QUICK_ACTIONS.map((a) => {
            const Icon = a.icon;
            return (
              <Button
                key={a.label}
                variant="outline"
                size="sm"
                className="gap-1.5"
                disabled={busy}
                onClick={() => send(a.prompt)}
              >
                <Icon className="size-3.5" />
                {a.label}
              </Button>
            );
          })}
        </div>
      )}

      {/* Ввод */}
      <form
        className="flex items-center gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Напишите ${ASSISTANT_NAME}…`}
          disabled={busy}
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} title="Отправить">
          <Send className="size-4" />
        </Button>
      </form>
    </Card>
  );
}

function Bubble({ role, text }: { role: "user" | "model"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm",
          isUser
            ? "rounded-br-sm bg-primary text-primary-foreground"
            : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        {text}
      </div>
    </div>
  );
}
