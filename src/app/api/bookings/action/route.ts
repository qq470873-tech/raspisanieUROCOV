import { badRequest, guardTeacher, json } from "@/lib/api";
import { bookingActionSchema } from "@/lib/schemas";
import {
  cancelBooking,
  confirmBooking,
  deleteBooking,
  getBookingById,
  rejectBooking,
} from "@/lib/queries";
import { notifyStudentDecision } from "@/lib/email";

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
    case "confirm":
      await confirmBooking(booking_id);
      await notifyStudentDecision(booking, booking.slot, "confirmed");
      break;
    case "reject":
      await rejectBooking(booking_id);
      await notifyStudentDecision(booking, booking.slot, "rejected");
      break;
    case "cancel":
      await cancelBooking(booking_id);
      break;
    case "delete":
      await deleteBooking(booking_id);
      break;
  }

  return json({ ok: true });
}
