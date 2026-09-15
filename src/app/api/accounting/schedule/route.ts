import { badRequest, json } from "@/lib/api";
import { guardAccounting } from "@/lib/accounting-lock";
import { getMoneySchedule, setException } from "@/lib/accounting";

/** Данные «Денежного расписания». */
export async function GET() {
  const denied = await guardAccounting();
  if (denied) return denied;
  return json(await getMoneySchedule());
}

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

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
