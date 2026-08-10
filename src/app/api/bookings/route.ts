import { badRequest, json } from "@/lib/api";
import { bookingInputSchema } from "@/lib/schemas";
import { createBooking, getBookingById, logEventFor } from "@/lib/queries";
import { getHouseholdId } from "@/lib/student-session";
import { notifyTeacherNewBooking } from "@/lib/email";

/** Публичный эндпоинт: создание заявки зарегистрированным учеником. */
export async function POST(request: Request) {
  const householdId = await getHouseholdId();
  if (!householdId) return json({ error: "Сначала укажите имя ученика" }, 401);

  const body = await request.json().catch(() => null);
  const parsed = bookingInputSchema.safeParse(body);
  if (!parsed.success) {
    return badRequest(parsed.error.issues[0]?.message ?? "Проверьте данные");
  }

  const d = parsed.data;
  const result = await createBooking({
    token: d.token,
    slot_id: d.slot_id,
    student_id: d.student_id,
    householdId,
    comment: d.comment || undefined,
    email: d.email || undefined,
  });

  if (!result.ok) {
    if (result.reason === "invalid_token") return json({ error: "Ссылка недействительна" }, 403);
    if (result.reason === "forbidden") return json({ error: "Ученик не найден" }, 403);
    if (result.reason === "taken")
      return json({ error: "Это время только что заняли. Выберите другое." }, 409);
    return json({ error: "Слот недоступен" }, 409);
  }

  // Уведомление преподавателю (email опционально — тихо пропустится, если не настроено).
  const withSlot = await getBookingById(result.booking.id);
  if (withSlot) {
    await notifyTeacherNewBooking(withSlot, withSlot.slot);
    await logEventFor(withSlot, "requested", "student");
  }

  return json({ ok: true, access_token: result.booking.access_token });
}
