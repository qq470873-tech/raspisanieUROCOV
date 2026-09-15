import { badRequest, guardTeacher, json } from "@/lib/api";
import { bookingActionSchema } from "@/lib/schemas";
import {
  cancelBooking,
  confirmBooking,
  deleteBooking,
  getBookingById,
  logEventFor,
  rejectBooking,
} from "@/lib/queries";

/** Действия преподавателя: подтвердить / отклонить / удалить / освободить. */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = bookingActionSchema.safeParse(body);
  if (!parsed.success) return badRequest("Некорректный запрос");

  const { booking_id, action } = parsed.data;
  const booking = await getBookingById(booking_id);
  if (!booking) return json({ error: "Заявка не найдена" }, 404);

  switch (action) {
    case "confirm": {
      const { rejected } = await confirmBooking(booking_id);
      await logEventFor(booking, "confirmed", "teacher");
      for (const r of rejected) {
        await logEventFor(r, "auto_rejected", "teacher");
      }
      break;
    }
    case "reject":
      await rejectBooking(booking_id);
      await logEventFor(booking, "rejected", "teacher");
      break;
    case "cancel":
      await cancelBooking(booking_id);
      await logEventFor(booking, "cancelled", "teacher");
      break;
    case "delete":
      await logEventFor(booking, "deleted", "teacher");
      await deleteBooking(booking_id);
      break;
  }

  return json({ ok: true });
}
