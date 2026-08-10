import { badRequest, json } from "@/lib/api";
import { quizResultSchema } from "@/lib/schemas";
import { saveQuizResult } from "@/lib/queries";
import { getHouseholdId } from "@/lib/student-session";

/** Публичный: сохранить результат тренажёра для ученика текущей сессии. */
export async function POST(request: Request) {
  const householdId = await getHouseholdId();
  if (!householdId) return json({ error: "Сначала укажите имя ученика" }, 401);

  const body = await request.json().catch(() => null);
  const parsed = quizResultSchema.safeParse(body);
  if (!parsed.success) return badRequest("Некорректный результат");

  const { student_id, level, score, total } = parsed.data;
  const res = await saveQuizResult({ studentId: student_id, householdId, level, score, total });
  if (!res.ok) return json({ error: "Ученик не найден" }, 403);
  return json({ ok: true });
}
