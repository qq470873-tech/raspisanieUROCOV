import { guardTeacher, json } from "@/lib/api";
import { markAllTeacherSeen } from "@/lib/queries";

export async function POST() {
  const denied = await guardTeacher();
  if (denied) return denied;

  await markAllTeacherSeen();
  return json({ ok: true });
}
