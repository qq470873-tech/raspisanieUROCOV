"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { apiPost } from "@/lib/client";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ASSISTANT_NAME = "Люси";
const LS_KEY = "lucy_active_conversation";

type Msg = { role: "user" | "model"; text: string };
type Conversation = { id: string; title: string; pinned: boolean };

const WELCOME = `Здравствуйте, Анастасия! Меня зовут ${ASSISTANT_NAME} 🌸 — ваша помощница и подруга.
Я вижу расписание, оплаты и домашние задания, помогу с делами — но и просто поболтать всегда рада 💬
Нажмите кнопку ниже или напишите мне что угодно.`;

const QUICK_ACTIONS = [
  {
    label: "Проверить несостыковки",
    icon: AlertTriangle,
    prompt:
      "Проверь расписание и оплаты на несостыковки: пересечения занятий по времени в один день, учеников-должников, подозрительные цены. Кратко перечисли, что нашла.",
  },
  {
    label: "Кто в долгу",
    icon: Wallet,
    prompt: "Покажи всех учеников с долгом (отрицательный остаток) и сумму. Если долгов нет — так и скажи.",
  },
  {
    label: "Сводка недели",
    icon: CalendarClock,
    prompt: "Дай краткую сводку по расписанию на неделю: сколько занятий, в какие дни, есть ли свободные слоты.",
  },
];

export function AssistantTab() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameText, setRenameText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // Загрузка списка диалогов при монтировании.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/assistant/conversations");
        const data = await res.json();
        let list: Conversation[] = data.conversations ?? [];
        if (list.length === 0) {
          const created = await apiPost<{ conversation: Conversation }>("/api/assistant/conversations", {
            action: "create",
          });
          list = [created.conversation];
        }
        setConversations(list);
        const saved = typeof window !== "undefined" ? localStorage.getItem(LS_KEY) : null;
        setActiveId(list.find((c) => c.id === saved)?.id ?? list[0].id);
      } catch {
        toast.error("Не удалось загрузить диалоги");
      }
    })();
  }, []);

  // Загрузка сообщений активного диалога.
  useEffect(() => {
    if (!activeId) return;
    localStorage.setItem(LS_KEY, activeId);
    setLoadingMsgs(true);
    fetch(`/api/assistant/messages?conversation=${activeId}`)
      .then((r) => r.json())
      .then((d) => setMessages((d.messages ?? []).map((m: Msg) => ({ role: m.role, text: m.text }))))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMsgs(false));
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function reloadConversations() {
    try {
      const res = await fetch("/api/assistant/conversations");
      const data = await res.json();
      setConversations(data.conversations ?? []);
    } catch {
      /* игнор */
    }
  }

  async function newChat() {
    try {
      const { conversation } = await apiPost<{ conversation: Conversation }>(
        "/api/assistant/conversations",
        { action: "create" },
      );
      setConversations((c) => [conversation, ...c]);
      setActiveId(conversation.id);
      setMessages([]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function removeChat(id: string) {
    if (!confirm("Удалить этот диалог?")) return;
    try {
      await apiPost("/api/assistant/conversations", { action: "delete", id });
      const rest = conversations.filter((c) => c.id !== id);
      setConversations(rest);
      if (activeId === id) {
        if (rest.length > 0) setActiveId(rest[0].id);
        else await newChat();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function togglePin(c: Conversation) {
    await apiPost("/api/assistant/conversations", { action: "pin", id: c.id, pinned: !c.pinned });
    reloadConversations();
  }

  async function saveRename(id: string) {
    if (!renameText.trim()) return setRenaming(null);
    await apiPost("/api/assistant/conversations", { action: "rename", id, title: renameText.trim() });
    setRenaming(null);
    reloadConversations();
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !activeId) return;
    setMessages((m) => [...m, { role: "user", text: trimmed }]);
    setInput("");
    setBusy(true);
    try {
      const res = await apiPost<{ reply: string; title: string | null }>("/api/assistant", {
        conversation_id: activeId,
        text: trimmed,
      });
      setMessages((m) => [...m, { role: "model", text: res.reply }]);
      if (res.title) reloadConversations();
    } catch (e) {
      setMessages((m) => [...m, { role: "model", text: `⚠️ ${e instanceof Error ? e.message : "Ошибка"}` }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(200px,260px)_1fr]">
      {/* Список диалогов */}
      <Card className="flex max-h-52 min-w-0 flex-col gap-2 p-2 lg:max-h-[70vh]">
        <Button size="sm" onClick={newChat} className="gap-1.5">
          <Plus className="size-4" /> Новый чат
        </Button>
        <div className="flex min-w-0 flex-col gap-0.5 overflow-y-auto">
          {conversations.map((c) => (
            <div
              key={c.id}
              className={cn(
                "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm",
                c.id === activeId ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              {c.pinned && <Pin className="size-3 shrink-0 opacity-70" />}
              {renaming === c.id ? (
                <input
                  value={renameText}
                  onChange={(e) => setRenameText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveRename(c.id)}
                  onBlur={() => saveRename(c.id)}
                  autoFocus
                  className="min-w-0 flex-1 rounded bg-background px-1 text-foreground"
                />
              ) : (
                <button onClick={() => setActiveId(c.id)} className="min-w-0 flex-1 truncate text-left">
                  {c.title}
                </button>
              )}
              <span
                className={cn(
                  "flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100",
                  c.id === activeId && "opacity-100",
                )}
              >
                <button onClick={() => togglePin(c)} className="rounded p-0.5 hover:bg-foreground/10" title={c.pinned ? "Открепить" : "Закрепить"}>
                  {c.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                </button>
                <button
                  onClick={() => {
                    setRenaming(c.id);
                    setRenameText(c.title);
                  }}
                  className="rounded p-0.5 hover:bg-foreground/10"
                  title="Переименовать"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button onClick={() => removeChat(c.id)} className="rounded p-0.5 hover:bg-foreground/10" title="Удалить">
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Чат */}
      <Card className="flex h-[70vh] min-w-0 flex-col overflow-hidden p-0">
        <div className="flex items-center gap-3 border-b bg-primary/5 px-4 py-3">
          <span className="brand-badge size-9">
            <Sparkles className="size-5" />
          </span>
          <div>
            <p className="text-sm font-semibold leading-tight">{ASSISTANT_NAME}</p>
            <p className="text-xs text-muted-foreground">помощница и подруга</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.length === 0 && !loadingMsgs && <Bubble role="model" text={WELCOME} />}
          {messages.map((m, i) => (
            <Bubble key={i} role={m.role} text={m.text} />
          ))}
          {busy && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {ASSISTANT_NAME} печатает…
            </div>
          )}
        </div>

        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 border-t px-4 py-3">
            {QUICK_ACTIONS.map((a) => {
              const Icon = a.icon;
              return (
                <Button key={a.label} variant="outline" size="sm" className="gap-1.5" disabled={busy} onClick={() => send(a.prompt)}>
                  <Icon className="size-3.5" />
                  {a.label}
                </Button>
              );
            })}
          </div>
        )}

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
            disabled={busy || !activeId}
            autoComplete="off"
            name="lucy-message"
          />
          <Button type="submit" size="icon" disabled={busy || !input.trim()} title="Отправить">
            <Send className="size-4" />
          </Button>
        </form>
      </Card>
    </div>
  );
}

function Bubble({ role, text }: { role: "user" | "model"; text: string }) {
  const isUser = role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm",
          isUser ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted text-foreground",
        )}
      >
        {text}
      </div>
    </div>
  );
}
