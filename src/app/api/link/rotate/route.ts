import { guardTeacher, json } from "@/lib/api";
import { rotateBookingToken } from "@/lib/queries";

export async function POST() {
  const denied = await guardTeacher();
  if (denied) return denied;

  const token = await rotateBookingToken();
  return json({ ok: true, token });
}
