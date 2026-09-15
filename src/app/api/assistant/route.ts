import { badRequest, guardTeacher, json } from "@/lib/api";
import { askAssistant, type ChatMessage } from "@/lib/assistant";

/** Чат с ИИ-ассистентом Люси. Доступен только преподавателю. */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { messages?: unknown } | null;
  const raw = body?.messages;
  if (!Array.isArray(raw) || raw.length === 0) {
    return badRequest("Нет сообщений");
  }

  const messages: ChatMessage[] = [];
  for (const m of raw) {
    const role = (m as ChatMessage)?.role;
    const text = (m as ChatMessage)?.text;
    if ((role !== "user" && role !== "model") || typeof text !== "string" || !text.trim()) {
      return badRequest("Некорректное сообщение");
    }
    messages.push({ role, text: text.slice(0, 4000) });
  }

  try {
    const reply = await askAssistant(messages.slice(-20));
    return json({ reply });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Ошибка ассистента" }, 502);
  }
}
