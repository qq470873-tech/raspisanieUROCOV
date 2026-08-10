import { badRequest, guardTeacher, json } from "@/lib/api";
import { unpairBooking } from "@/lib/queries";
import { z } from "zod";

const schema = z.object({ booking_id: z.string().uuid() });

/** Убирает последнего добавленного участника группового занятия. */
export async function POST(request: Request) {
  const denied = await guardTeacher();
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return badRequest("Некорректный запрос");

  await unpairBooking(parsed.data.booking_id);
  return json({ ok: true });
}
