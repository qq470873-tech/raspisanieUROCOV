import { json } from "@/lib/api";

/** Ответы учеников на предложенное время отключены. */
export async function POST() {
  return json({ error: "Онлайн-запись закрыта" }, 403);
}
