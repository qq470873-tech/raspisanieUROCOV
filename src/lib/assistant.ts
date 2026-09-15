import "server-only";
import { env } from "./env";
import { getSlotsWithBookings, bookingNames } from "./queries";
import { getStudentBalances } from "./accounting";
import { formatRange, weekdayShort } from "./domain";
import { formatMoney, todayNN } from "./time-nn";

/** Имя ассистента и имя пользователя — единая точка настройки. */
export const ASSISTANT_NAME = "Люси";
export const TEACHER_NAME = "Анастасия";

export type ChatRole = "user" | "model";
export interface ChatMessage {
  role: ChatRole;
  text: string;
}

const SYSTEM_PROMPT = `Ты — ${ASSISTANT_NAME}, дружелюбный и внимательный ИИ-ассистент в личной программе преподавателя-репетитора.
Пользователя зовут ${TEACHER_NAME}. Обращайся к ней по имени вежливо, когда это уместно (например в приветствии или при выводах) — но не в каждом предложении, чтобы звучать естественно.
Отвечай на русском языке, тепло, кратко и по делу. Умеренно используй эмодзи.
Тебе передают АКТУАЛЬНЫЕ данные программы: расписание занятий и финансовые балансы учеников. Опирайся только на них — ничего не выдумывай. Если данных не хватает, честно скажи об этом.
Ты умеешь: анализировать расписание, находить несостыковки (пересечения занятий по времени в один день, учеников-должников, подозрительные цены), считать балансы и долги, отвечать на вопросы по ученикам и оплатам.
Все даты и «сегодня» — по времени Нижнего Новгорода. Отрицательный баланс = долг ученика.`;

/** Собирает компактный снимок данных программы для передачи модели. */
export async function buildContext(): Promise<string> {
  const [slots, balances] = await Promise.all([getSlotsWithBookings(), getStudentBalances()]);

  const scheduleLines = slots
    .filter((s) => s.is_active)
    .map((s) => {
      const who = s.booking ? bookingNames(s.booking) : "— свободно";
      const st = s.booking ? s.booking.status : "";
      return `- ${weekdayShort(s.weekday)} ${formatRange(s.start_time, s.end_time)}: ${who}${st ? ` (${st})` : ""}`;
    });

  const balanceLines = balances.map((b) => {
    const debt = b.balanceKopecks < 0 ? " ⚠️ ДОЛГ" : "";
    return `- ${b.name}: оплачено ${formatMoney(b.creditedKopecks)}, списано ${formatMoney(
      b.consumedKopecks,
    )}, остаток ${formatMoney(b.balanceKopecks)} (${b.lessonsPerWeek} зан/нед)${debt}`;
  });

  return [
    `Сегодня (Нижний Новгород): ${todayNN()}`,
    "",
    "РАСПИСАНИЕ (активные слоты):",
    scheduleLines.length ? scheduleLines.join("\n") : "— расписание пусто",
    "",
    "БАЛАНСЫ УЧЕНИКОВ:",
    balanceLines.length ? balanceLines.join("\n") : "— в бухгалтерии пока нет данных",
  ].join("\n");
}

interface GeminiPart {
  text?: string;
}
interface GeminiCandidate {
  content?: { parts?: GeminiPart[] };
}
interface GeminiResponse {
  candidates?: GeminiCandidate[];
  error?: { message?: string };
  promptFeedback?: { blockReason?: string };
}

interface GeminiCall {
  ok: boolean;
  text?: string;
  status: number;
  error?: string;
  overloaded?: boolean;
}

/** Один вызов конкретной модели Gemini. */
async function callGemini(
  model: string,
  system: string,
  history: ChatMessage[],
): Promise<GeminiCall> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": env.geminiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig: { temperature: 0.4, maxOutputTokens: 1200 },
      }),
    },
  );

  const data = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    const msg = data.error?.message ?? `Gemini вернул ошибку ${res.status}`;
    const overloaded = res.status === 429 || res.status >= 500 || /demand|overload/i.test(msg);
    return { ok: false, status: res.status, error: msg, overloaded };
  }
  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("")
    .trim();
  if (!text) {
    const reason = data.promptFeedback?.blockReason;
    return { ok: false, status: res.status, error: reason ? `Ответ заблокирован (${reason})` : "Пустой ответ от модели" };
  }
  return { ok: true, status: res.status, text };
}

/**
 * Отправляет историю чата в Gemini вместе с системным промптом и снимком данных.
 * При перегрузке основной модели пробует запасную (flash-lite). Возвращает текст ответа.
 */
export async function askAssistant(history: ChatMessage[]): Promise<string> {
  const context = await buildContext();
  const system = `${SYSTEM_PROMPT}\n\n=== ДАННЫЕ ПРОГРАММЫ ===\n${context}`;

  // Основная модель + запасная на случай «high demand».
  const models = [env.geminiModel(), "gemini-flash-lite-latest"];
  let last: GeminiCall | null = null;
  for (const model of models) {
    const r = await callGemini(model, system, history);
    if (r.ok) return r.text!;
    last = r;
    if (!r.overloaded) break; // не перегрузка (напр. блокировка) — не пробуем дальше
  }
  throw new Error(last?.error ?? "Ошибка ассистента");
}
