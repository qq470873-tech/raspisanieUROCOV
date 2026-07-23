import { badRequest, guardTeacher, json } from "@/lib/api";
import { createSlotsSchema } from "@/lib/schemas";
import { createSlots } from "@/lib/queries";

export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = createSlotsSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Некорректные слоты");
  }

  await createSlots(parsed.data.slots);
  return json({ ok: true });
}
