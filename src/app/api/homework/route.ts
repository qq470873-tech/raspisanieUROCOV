import { badRequest, guardTeacher, json } from "@/lib/api";
import { getAllStudents } from "@/lib/queries";
import { deleteHomework, listHomework, saveHomework } from "@/lib/homework";

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** GET без параметров → список учеников; GET ?student=id → ДЗ ученика. */
export async function GET(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;
  const studentId = new URL(request.url).searchParams.get("student");
  if (studentId) return json({ entries: await listHomework(studentId) });
  const students = await getAllStudents();
  return json({ students: students.map((s) => ({ id: s.id, name: s.name })) });
}

/** POST save {student_id, date, text} / delete {id}. */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const b = (await request.json().catch(() => null)) as
    | { action?: string; student_id?: string; date?: unknown; text?: string; id?: string }
    | null;

  try {
    if (b?.action === "delete") {
      if (!b.id) return badRequest("Нет записи");
      await deleteHomework(b.id);
      return json({ ok: true });
    }
    // save
    if (!b?.student_id || !isDate(b.date) || !b.text?.trim()) {
      return badRequest("Заполните ученика, дату и текст");
    }
    await saveHomework(b.student_id, b.date, b.text.trim());
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Ошибка" }, 500);
  }
}
