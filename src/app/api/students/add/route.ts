import { badRequest, guardTeacher, json } from "@/lib/api";
import { registerStudents } from "@/lib/queries";

/** Добавляет нового ученика (или возвращает существующего с тем же именем). */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { name?: unknown } | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (name.length < 2) return badRequest("Укажите имя и фамилию");

  const { students } = await registerStudents([name]);
  const student = students[0];
  if (!student) return json({ error: "Не удалось добавить" }, 500);
  return json({ ok: true, student: { id: student.id, name: student.name } });
}
