import { badRequest, guardTeacher, json } from "@/lib/api";
import { studentRenameSchema } from "@/lib/schemas";
import { renameStudent } from "@/lib/queries";

export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = studentRenameSchema.safeParse(body);
  if (!parsed.success) return badRequest(parsed.error.issues[0]?.message ?? "Некорректно");

  try {
    await renameStudent(parsed.data.id, parsed.data.name);
  } catch (e) {
    if ((e as { code?: string })?.code === "23505") {
      return json({ error: "Такой ученик уже есть — используйте «Объединить»" }, 409);
    }
    throw e;
  }
  return json({ ok: true });
}
