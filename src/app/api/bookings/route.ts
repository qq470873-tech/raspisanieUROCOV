import { badRequest, json } from "@/lib/api";
import { bookingInputSchema } from "@/lib/schemas";
import { createBooking, getBookingById } from "@/lib/queries";
import { notifyTeacherNewBooking } from "@/lib/email";

/** Публичный эндпоинт: создание заявки родителем. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = bookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Проверьте данные");
  }

  const d = parsed.data;
  const result = await createBooking({
    token: d.token,
    slot_id: d.slot_id,
    student_1: d.student_1,
    student_2: d.student_2 || undefined,
    comment: d.comment || undefined,
    email: d.email || undefined,
  });

  if (!result.ok) {
    if (result.reason === "invalid_token") return json({ error: "Ссылка недействительна" }, 403);
    if (result.reason === "taken")
      return json({ error: "Это время только что заняли. Выберите другое." }, 409);
    return json({ error: "Слот недоступен" }, 409);
  }

  // Уведомление преподавателю (email опционально — тихо пропустится, если не настроено).
  const withSlot = await getBookingById(result.booking.id);
  if (withSlot) await notifyTeacherNewBooking(withSlot, withSlot.slot);

  return json({ ok: true, access_token: result.booking.access_token });
}
