import { json } from "@/lib/api";
import { destroySessionCookie } from "@/lib/auth";

export async function POST() {
  await destroySessionCookie();
  return json({ ok: true });
}
