import { badRequest, json } from "@/lib/api";
import { guardAccounting } from "@/lib/accounting-lock";
import { getMoneySchedule, setException } from "@/lib/accounting";
import { currentWeekMonday, mondayOf } from "@/lib/time-nn";

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Денежное расписание на неделю (?week=YYYY-MM-DD, по умолчанию — текущая). */
export async function GET(request: Request) {
  const denied = await guardAccounting();
  if (denied) return denied;
  const url = new URL(request.url);
  const week = url.searchParams.get("week");
  const weekMonday = isDate(week) ? mondayOf(week) : currentWeekMonday();
  return json(await getMoneySchedule(weekMonday));
}

/** Отметить/снять «урока не было». */
export async function POST(request: Request) {
  const denied = await guardAccounting();
  if (denied) return denied;

  const b = (await request.json().catch(() => null)) as
    | { slot_id?: string; date?: unknown; on?: unknown }
    | null;
  if (!b?.slot_id || !isDate(b.date)) return badRequest("Не хватает данных");

  try {
    await setException(b.slot_id, b.date, b.on === true);
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Ошибка" }, 500);
  }
}
