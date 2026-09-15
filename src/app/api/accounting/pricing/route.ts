import { badRequest, json } from "@/lib/api";
import { guardAccounting } from "@/lib/accounting-lock";
import {
  addPayerByName,
  getPricingData,
  removePayer,
  setDefaultPrice,
  upsertPayer,
} from "@/lib/accounting";

/** Данные раздела «Настройка стоимости». */
export async function GET() {
  const denied = await guardAccounting();
  if (denied) return denied;
  return json(await getPricingData());
}

type Body = {
  action?: string;
  slot_id?: string;
  student_id?: string;
  name?: string;
  price_kopecks?: number;
};

/** Мутации цен: upsert / add (по имени) / remove / default. */
export async function POST(request: Request) {
  const denied = await guardAccounting();
  if (denied) return denied;

  const b = (await request.json().catch(() => null)) as Body | null;
  if (!b?.action) return badRequest("Нет действия");

  const price = Number.isFinite(b.price_kopecks) ? Math.max(0, Math.round(b.price_kopecks!)) : 0;

  try {
    switch (b.action) {
      case "upsert":
        if (!b.slot_id || !b.student_id) return badRequest("Не хватает данных");
        await upsertPayer(b.slot_id, b.student_id, price);
        break;
      case "add":
        if (!b.slot_id || !b.name?.trim()) return badRequest("Укажите имя");
        await addPayerByName(b.slot_id, b.name, price);
        break;
      case "remove":
        if (!b.slot_id || !b.student_id) return badRequest("Не хватает данных");
        await removePayer(b.slot_id, b.student_id);
        break;
      case "default":
        await setDefaultPrice(price);
        break;
      default:
        return badRequest("Неизвестное действие");
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Ошибка" }, 500);
  }
}
