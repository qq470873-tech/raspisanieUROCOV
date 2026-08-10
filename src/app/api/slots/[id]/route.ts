import { badRequest, guardTeacher, json } from "@/lib/api";
import { slotUpdateSchema } from "@/lib/schemas";
import { deleteSlot, setSlotActive, updateSlotTime } from "@/lib/queries";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Ctx) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const { id } = await params;
  await deleteSlot(id);
  return json({ ok: true });
}

export async function PATCH(request: Request, { params }: Ctx) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));

  // Изменение времени слота (сдвиг), если переданы start/end.
  if (body && (body.start_time !== undefined || body.end_time !== undefined)) {
    const parsed = slotUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? "Некорректное время");
    }
    await updateSlotTime(id, parsed.data.start_time, parsed.data.end_time);
    return json({ ok: true });
  }

  await setSlotActive(id, Boolean(body?.is_active));
  return json({ ok: true });
}
