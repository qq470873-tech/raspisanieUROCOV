import { json } from "@/lib/api";

/** Самозапись учеников отключена — эндпоинт закрыт. */
export async function POST() {
  return json({ error: "Онлайн-запись закрыта" }, 403);
}
