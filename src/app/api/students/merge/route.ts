import { badRequest, guardTeacher, json } from "@/lib/api";
import { studentMergeSchema } from "@/lib/schemas";
import { mergeStudents } from "@/lib/queries";

export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = studentMergeSchema.safeParse(body);
  if (!parsed.success) return badRequest("Некорректный запрос");
  if (parsed.data.source_id === parsed.data.target_id) {
    return badRequest("Выберите разных учеников");
  }

  await mergeStudents(parsed.data.source_id, parsed.data.target_id);
  return json({ ok: true });
}
