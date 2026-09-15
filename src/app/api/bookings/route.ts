import { json } from "@/lib/api";

/** Создание заявок учениками отключено — запись ведёт только преподаватель. */
export async function POST() {
  return json({ error: "Онлайн-запись закрыта" }, 403);
}
