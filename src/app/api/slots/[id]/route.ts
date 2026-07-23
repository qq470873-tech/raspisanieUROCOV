import { guardTeacher, json } from "@/lib/api";
import { deleteSlot, setSlotActive } from "@/lib/queries";

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
  await setSlotActive(id, Boolean(body?.is_active));
  return json({ ok: true });
}
