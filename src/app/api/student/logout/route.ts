import { json } from "@/lib/api";
import { clearHouseholdCookie } from "@/lib/student-session";

/** Публичный эндпоинт: «это не вы» — сбросить личность ученика. */
export async function POST() {
  await clearHouseholdCookie();
  return json({ ok: true });
}
