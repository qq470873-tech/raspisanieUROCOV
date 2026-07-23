import { badRequest, guardTeacher, json } from "@/lib/api";
import { bookingMoveSchema } from "@/lib/schemas";
import { getBookingById, moveBooking } from "@/lib/queries";
import { notifyStudentDecision, notifyStudentProposal } from "@/lib/email";

/** Перенос заявки в другой слот или предложение времени ученику. */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = bookingMoveSchema.safeParse(body);
  if (!parsed.success) return badRequest("Некорректный запрос");

  const { booking_id, target_slot_id, mode } = parsed.data;
  const result = await moveBooking(booking_id, target_slot_id, mode);
  if (!result.ok) {
    if (result.reason === "taken") return json({ error: "Целевой слот занят" }, 409);
    return json({ error: "Слот недоступен" }, 409);
  }

  const updated = await getBookingById(booking_id);
  if (updated) {
    if (mode === "propose") await notifyStudentProposal(updated, updated.slot);
    else await notifyStudentDecision(updated, updated.slot, "confirmed");
  }

  return json({ ok: true });
}
