import { badRequest, json } from "@/lib/api";
import { guardAccounting } from "@/lib/accounting-lock";
import {
  addPayment,
  deletePayment,
  getPaymentsOverview,
  setAnchor,
  setBalanceManual,
} from "@/lib/accounting";

/** Данные раздела «Оплата занятий». */
export async function GET() {
  const denied = await guardAccounting();
  if (denied) return denied;
  return json(await getPaymentsOverview());
}

type Body = {
  action?: string;
  student_id?: string;
  payment_id?: string;
  amount_kopecks?: number;
  paid_at?: string;
  note?: string;
  date?: string;
  target_kopecks?: number;
};

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** Мутации: add (платёж) / delete / anchor (дата отсчёта) / setBalance (ручной остаток). */
export async function POST(request: Request) {
  const denied = await guardAccounting();
  if (denied) return denied;

  const b = (await request.json().catch(() => null)) as Body | null;
  if (!b?.action) return badRequest("Нет действия");

  try {
    switch (b.action) {
      case "add": {
        if (!b.student_id) return badRequest("Не выбран ученик");
        if (!isDate(b.paid_at)) return badRequest("Некорректная дата");
        if (!Number.isFinite(b.amount_kopecks) || b.amount_kopecks === 0) {
          return badRequest("Укажите сумму");
        }
        await addPayment(b.student_id, b.amount_kopecks!, b.paid_at, b.note?.trim() || null);
        break;
      }
      case "delete":
        if (!b.payment_id) return badRequest("Нет платежа");
        await deletePayment(b.payment_id);
        break;
      case "anchor":
        if (!b.student_id || !isDate(b.date)) return badRequest("Некорректная дата");
        await setAnchor(b.student_id, b.date);
        break;
      case "setBalance":
        if (!b.student_id || !Number.isFinite(b.target_kopecks)) return badRequest("Не хватает данных");
        await setBalanceManual(b.student_id, b.target_kopecks!);
        break;
      default:
        return badRequest("Неизвестное действие");
    }
    return json({ ok: true });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : "Ошибка" }, 500);
  }
}
