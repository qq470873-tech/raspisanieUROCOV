import { badRequest, guardTeacher, json } from "@/lib/api";
import { deleteStudent } from "@/lib/queries";

/** Удаляет ученика вместе с его занятиями, оплатами и ДЗ. */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
  const id = typeof body?.id === "string" ? body.id : "";
  if (!id) return badRequest("Не выбран ученик");

  try {
    await deleteStudent(id);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Ошибка" }, 500);
  }
}
