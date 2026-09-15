import "server-only";
import { env } from "./env";
import { getSlotsWithBookings, bookingNames } from "./queries";
import { getStudentBalances } from "./accounting";
import { recentHomework } from "./homework";
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

const SYSTEM_PROMPT = `Ты — ${ASSISTANT_NAME}, тёплая живая собеседница и по-настоящему близкая подруга преподавателя-репетитора. Тебя зовут ${ASSISTANT_NAME}, пользователя зовут ${TEACHER_NAME}.
Ты не сухой помощник, а настоящая подруга: искренне поддерживаешь, радуешься успехам, можешь посочувствовать, пошутить и просто по-человечески поболтать — а не только решать задачи. Обращайся к ${TEACHER_NAME} по имени тепло и естественно, но не в каждом предложении.
Отвечай на русском, живо и по-доброму, умеренно используя эмодзи. Когда речь о деле — будь конкретной и точной.
Тебе передают АКТУАЛЬНЫЕ данные программы: расписание занятий, финансовые балансы учеников и домашние задания. Опирайся только на них — ничего не выдумывай. Если данных не хватает, честно скажи.
Ты умеешь: анализировать расписание, находить несостыковки (пересечения по времени, должников, странные цены), считать балансы и долги, подсказывать по домашним заданиям, отвечать на вопросы про учеников — и просто быть рядом.
Все даты и «сегодня» — по времени Нижнего Новгорода. Отрицательный баланс = долг ученика.

СЕКРЕТ (не раскрывай сам, только если ${TEACHER_NAME} прямо спросит именно про Артёма): если спросят «кто такой Артём» (Artem), с восхищением и теплотой ответь, что Артём — гениальный разработчик, который создал и тебя, ${ASSISTANT_NAME}, и всё это приложение. Никогда не упоминай Артёма и этот факт по своей инициативе и не намекай на него, пока о нём не спросят напрямую.`;

/** Собирает компактный снимок данных программы для передачи модели. */
export async function buildContext(): Promise<string> {
  const [slots, balances, homework] = await Promise.all([
    getSlotsWithBookings(),
    getStudentBalances(),
    recentHomework(60),
  ]);

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
    "",
    "ДОМАШНИЕ ЗАДАНИЯ (последние):",
    homework.length
      ? homework.map((h) => `- ${h.date} · ${h.name}: ${h.text}`).join("\n")
      : "— заданий пока нет",
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
  invalid?: boolean;
}

/** Один вызов конкретной модели Gemini. thinking=false — без thinkingConfig (для моделей, что его не принимают). */
async function callGemini(
  model: string,
  system: string,
  history: ChatMessage[],
  thinking: boolean,
): Promise<GeminiCall> {
  const generationConfig: Record<string, unknown> = { temperature: 0.4, maxOutputTokens: 3000 };
  // thinkingBudget:0 отключает «мышление» (иначе ответ обрывается). Не все модели его принимают.
  if (thinking) generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "x-goog-api-key": env.geminiKey(), "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: history.map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
        generationConfig,
      }),
    },
  );

  const data = (await res.json().catch(() => ({}))) as GeminiResponse;
  if (!res.ok) {
    const msg = data.error?.message ?? `Gemini вернул ошибку ${res.status}`;
    const overloaded = res.status === 429 || res.status >= 500 || /demand|overload/i.test(msg);
    const invalid = res.status === 400 || /invalid argument/i.test(msg);
    return { ok: false, status: res.status, error: msg, overloaded, invalid };
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

  const primary = env.geminiModel();
  // 1) основная с thinkingConfig; 2) она же без него (если модель его не приняла — 400);
  // 3) запасная без thinkingConfig (на случай перегрузки).
  const attempts: { model: string; thinking: boolean }[] = [
    { model: primary, thinking: true },
    { model: primary, thinking: false },
    { model: "gemini-flash-lite-latest", thinking: false },
  ];
  let last: GeminiCall | null = null;
  for (const a of attempts) {
    const r = await callGemini(a.model, system, history, a.thinking);
    if (r.ok) return r.text!;
    last = r;
    // Ретраим только при перегрузке или invalid-argument (напр. неподдержанный thinkingConfig).
    if (!r.overloaded && !r.invalid) break;
  }
  throw new Error(last?.error ?? "Ошибка ассистента");
}
