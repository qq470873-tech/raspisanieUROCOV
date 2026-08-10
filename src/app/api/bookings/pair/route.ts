import { badRequest, guardTeacher, json } from "@/lib/api";
import { bookingPairSchema } from "@/lib/schemas";
import { logEventFor, setBookingPartner } from "@/lib/queries";
import { notifyPairedPartner } from "@/lib/email";

/** Учитель делает занятие парным: добавляет второго ученика. */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = bookingPairSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Некорректный запрос");
  }

  const { booking_id, student_id, name } = parsed.data;
  const result = await setBookingPartner(booking_id, { studentId: student_id, name });
  if (!result.ok) {
    if (result.reason === "self") return json({ error: "Этот ученик уже в занятии" }, 409);
    if (result.reason === "full") return json({ error: "В занятии уже трое" }, 409);
    return json({ error: "Ученик не найден" }, 404);
  }

  await notifyPairedPartner(
    result.partner.email,
    result.partner.name,
    result.booking.student_1,
    result.booking.slot,
  );
  await logEventFor(result.booking, "paired", "teacher");

  return json({ ok: true });
}
