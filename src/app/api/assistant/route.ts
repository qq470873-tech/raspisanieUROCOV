import { badRequest, guardTeacher, json } from "@/lib/api";
import { askAssistant, type ChatMessage } from "@/lib/assistant";
import { addMessage, autoTitle, getMessages } from "@/lib/chat";

/** Отправка сообщения в диалог: сохраняет пару вопрос-ответ и возвращает ответ Люси. */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as
    | { conversation_id?: unknown; text?: unknown }
    | null;
  const conversationId = typeof body?.conversation_id === "string" ? body.conversation_id : "";
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!conversationId) return badRequest("Нет диалога");
  if (!text) return badRequest("Пустое сообщение");

  const prior = await getMessages(conversationId);
  const history: ChatMessage[] = [
    ...prior.map((m) => ({ role: m.role, text: m.text })),
    { role: "user" as const, text: text.slice(0, 4000) },
  ];

  try {
    const reply = await askAssistant(history.slice(-20));
    await addMessage(conversationId, "user", text.slice(0, 4000));
    await addMessage(conversationId, "model", reply);
    const title = await autoTitle(conversationId, text);
    return json({ reply, title });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Ошибка ассистента" }, 502);
  }
}
