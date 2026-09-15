import { badRequest, guardTeacher, json } from "@/lib/api";
import { manualBookingSchema } from "@/lib/schemas";
import { createManualBooking, logEventFor } from "@/lib/queries";

/** Учитель вручную добавляет запись (для тех, кто написал/позвонил). */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = manualBookingSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Некорректный запрос");
  }

  const { student_id, name, slot_id, custom_time } = parsed.data;
  const result = await createManualBooking({
    studentId: student_id,
    name,
    slotId: slot_id,
    customTime: custom_time,
  });

  if (!result.ok) {
    if (result.reason === "taken") return json({ error: "Это время уже занято" }, 409);
    if (result.reason === "student") return json({ error: "Укажите ученика" }, 400);
    return json({ error: "Некорректное время" }, 400);
  }

  await logEventFor(result.booking, "confirmed", "teacher");
  for (const r of result.rejected) {
    await logEventFor(r, "auto_rejected", "teacher");
  }

  return json({ ok: true });
}
