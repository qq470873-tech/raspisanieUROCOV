import { badRequest, json } from "@/lib/api";
import { studentRegisterSchema } from "@/lib/schemas";
import { isValidToken, registerStudents } from "@/lib/queries";
import { setHouseholdCookie } from "@/lib/student-session";

/** Публичный эндпоинт: регистрация ученика(-ов) и установка cookie личности. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = studentRegisterSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Проверьте данные");
  }

  const { token, names, email } = parsed.data;
  if (!(await isValidToken(token))) {
    return json({ error: "Ссылка недействительна" }, 403);
  }

  const { students, householdId } = await registerStudents(names, email || undefined);
  await setHouseholdCookie(householdId);

  return json({
    ok: true,
    students: students.map((s) => ({ id: s.id, name: s.name })),
  });
}
