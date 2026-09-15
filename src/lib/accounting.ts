import "server-only";
import { supabaseAdmin } from "./supabase";
import type { Slot } from "./domain";
import { timeToMinutes } from "./domain";
import { registerStudents } from "./queries";
import { dateForWeekdayThisWeek, todayNN, weekdayDatesInRange } from "./time-nn";

export interface LessonPayer {
  id: string;
  slot_id: string;
  student_id: string;
  price_kopecks: number;
}

export interface Payment {
  id: string;
  student_id: string;
  amount_kopecks: number;
  paid_at: string; // YYYY-MM-DD
  note: string | null;
  created_at: string;
}

export interface LessonException {
  id: string;
  slot_id: string;
  student_id: string | null;
  date: string; // YYYY-MM-DD
}

/** Сводка по счёту ученика (модель «баланс»). */
export interface StudentBalance {
  studentId: string;
  name: string;
  creditedKopecks: number; // всего оплачено
  consumedKopecks: number; // списано за прошедшие занятия
  balanceKopecks: number; // остаток (может быть отрицательным = долг)
  weeklyBurnKopecks: number; // стоимость всех занятий ученика за неделю
  lessonsPerWeek: number;
  anchorDate: string;
}

async function selectAll<T>(table: string): Promise<T[]> {
  const db = supabaseAdmin();
  const { data } = await db.from(table).select("*");
  return (data ?? []) as T[];
}

// ── Настройка стоимости (раздел 3) ─────────────────────────────────────────────

export interface SlotPayerView {
  student_id: string;
  name: string;
  price_kopecks: number;
}

export interface SlotPricing {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  payers: SlotPayerView[];
}

export interface PricingData {
  defaultPriceKopecks: number;
  students: { id: string; name: string }[];
  slots: SlotPricing[];
}

/** Данные для раздела «Настройка стоимости»: слоты с плательщиками + список учеников. */
export async function getPricingData(): Promise<PricingData> {
  const db = supabaseAdmin();
  const [slots, payers, students, settings] = await Promise.all([
    selectAll<Slot>("slots"),
    selectAll<LessonPayer>("lesson_payers"),
    db.from("students").select("id, name").then((r) => (r.data ?? []) as { id: string; name: string }[]),
    db.from("settings").select("default_price_kopecks").eq("id", 1).maybeSingle(),
  ]);

  const nameMap = new Map(students.map((s) => [s.id, s.name]));
  const slotSorted = [...slots].sort(
    (a, b) => a.weekday - b.weekday || timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
  );

  return {
    defaultPriceKopecks:
      (settings.data as { default_price_kopecks: number } | null)?.default_price_kopecks ?? 0,
    students: [...students].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    slots: slotSorted.map((s) => ({
      id: s.id,
      weekday: s.weekday,
      start_time: s.start_time,
      end_time: s.end_time,
      is_active: s.is_active,
      payers: payers
        .filter((p) => p.slot_id === s.id)
        .map((p) => ({
          student_id: p.student_id,
          name: nameMap.get(p.student_id) ?? "—",
          price_kopecks: p.price_kopecks,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    })),
  };
}

/** Добавляет/обновляет плательщика на слоте (по ученику из базы). */
export async function upsertPayer(
  slotId: string,
  studentId: string,
  priceKopecks: number,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("lesson_payers")
    .upsert(
      { slot_id: slotId, student_id: studentId, price_kopecks: priceKopecks },
      { onConflict: "slot_id,student_id" },
    );
  if (error) throw new Error(error.message);
  await ensureBilling(studentId);
}

/** Добавляет плательщика по имени (создаёт ученика при необходимости). */
export async function addPayerByName(
  slotId: string,
  name: string,
  priceKopecks: number,
): Promise<void> {
  const { students } = await registerStudents([name.trim()]);
  const student = students[0];
  if (!student) throw new Error("Не удалось создать ученика");
  await upsertPayer(slotId, student.id, priceKopecks);
}

/** Убирает плательщика со слота. */
export async function removePayer(slotId: string, studentId: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("lesson_payers")
    .delete()
    .eq("slot_id", slotId)
    .eq("student_id", studentId);
  if (error) throw new Error(error.message);
}

export async function setDefaultPrice(priceKopecks: number): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("settings")
    .upsert({ id: 1, default_price_kopecks: priceKopecks });
  if (error) throw new Error(error.message);
}

/** Создаёт строку биллинга ученику, если её ещё нет (anchor = сегодня по НН). */
export async function ensureBilling(studentId: string): Promise<void> {
  const db = supabaseAdmin();
  await db
    .from("student_billing")
    .upsert({ student_id: studentId }, { onConflict: "student_id", ignoreDuplicates: true });
}

// ── Оплата занятий (раздел 2) ──────────────────────────────────────────────────

export interface PaymentsStudent extends StudentBalance {
  perLessonKopecks: number; // средняя цена одного занятия
  lessonsLeft: number | null; // осталось занятий (null, если цена не задана)
  payments: Payment[]; // история платежей (свежие сверху)
}

/** Данные для раздела «Оплата занятий»: балансы + история платежей по каждому ученику. */
export async function getPaymentsOverview(): Promise<{ students: PaymentsStudent[] }> {
  const [balances, payments] = await Promise.all([
    getStudentBalances(),
    selectAll<Payment>("payments"),
  ]);

  const byStudent = new Map<string, Payment[]>();
  for (const p of payments) {
    const arr = byStudent.get(p.student_id) ?? [];
    arr.push(p);
    byStudent.set(p.student_id, arr);
  }

  const students = balances.map((b) => {
    const perLesson =
      b.lessonsPerWeek > 0 ? Math.round(b.weeklyBurnKopecks / b.lessonsPerWeek) : 0;
    const list = (byStudent.get(b.studentId) ?? []).sort((a, c) =>
      c.paid_at === a.paid_at ? c.created_at.localeCompare(a.created_at) : c.paid_at.localeCompare(a.paid_at),
    );
    return {
      ...b,
      perLessonKopecks: perLesson,
      lessonsLeft: perLesson > 0 ? Math.floor(b.balanceKopecks / perLesson) : null,
      payments: list,
    };
  });

  return { students };
}

export async function addPayment(
  studentId: string,
  amountKopecks: number,
  paidAt: string,
  note: string | null,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("payments")
    .insert({ student_id: studentId, amount_kopecks: Math.round(amountKopecks), paid_at: paidAt, note });
  if (error) throw new Error(error.message);
  await ensureBilling(studentId);
}

export async function deletePayment(id: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db.from("payments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function setAnchor(studentId: string, date: string): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("student_billing")
    .upsert({ student_id: studentId, anchor_date: date }, { onConflict: "student_id" });
  if (error) throw new Error(error.message);
}

/**
 * «Выставить остаток вручную»: добавляет корректирующий платёж так, чтобы текущий
 * баланс ученика стал равен targetKopecks.
 */
export async function setBalanceManual(studentId: string, targetKopecks: number): Promise<void> {
  const balances = await getStudentBalances();
  const cur = balances.find((b) => b.studentId === studentId)?.balanceKopecks ?? 0;
  const delta = Math.round(targetKopecks) - cur;
  if (delta === 0) return;
  await addPayment(studentId, delta, todayNN(), "Ручная корректировка остатка");
}

// ── Денежное расписание (раздел 1) ─────────────────────────────────────────────

export interface MoneyPayer {
  student_id: string;
  name: string;
  price_kopecks: number;
  balanceKopecks: number;
  status: "paid" | "debt"; // хватает ли баланса на это занятие
}

export interface MoneySlot {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  payers: MoneyPayer[];
  exceptions: string[]; // даты, когда «урока не было» (для всего слота)
  thisWeekDate: string; // дата этого дня недели в текущей неделе
}

/** Данные для «Денежного расписания»: активные слоты + статус оплаты каждого плательщика. */
export async function getMoneySchedule(): Promise<{ slots: MoneySlot[] }> {
  const [pricing, balances, exceptions] = await Promise.all([
    getPricingData(),
    getStudentBalances(),
    selectAll<LessonException>("lesson_exceptions"),
  ]);
  const balMap = new Map(balances.map((b) => [b.studentId, b.balanceKopecks]));

  const slots = pricing.slots
    .filter((s) => s.is_active)
    .map((s) => ({
      id: s.id,
      weekday: s.weekday,
      start_time: s.start_time,
      end_time: s.end_time,
      payers: s.payers.map((p) => {
        const bal = balMap.get(p.student_id) ?? 0;
        return {
          student_id: p.student_id,
          name: p.name,
          price_kopecks: p.price_kopecks,
          balanceKopecks: bal,
          status: (bal >= p.price_kopecks ? "paid" : "debt") as "paid" | "debt",
        };
      }),
      exceptions: exceptions
        .filter((e) => e.slot_id === s.id && e.student_id === null)
        .map((e) => e.date)
        .sort(),
      thisWeekDate: dateForWeekdayThisWeek(s.weekday),
    }));

  return { slots };
}

/** Отмечает/снимает «урока не было» для всего слота на конкретную дату (идемпотентно). */
export async function setException(slotId: string, date: string, on: boolean): Promise<void> {
  const db = supabaseAdmin();
  await db
    .from("lesson_exceptions")
    .delete()
    .eq("slot_id", slotId)
    .eq("date", date)
    .is("student_id", null);
  if (on) {
    const { error } = await db
      .from("lesson_exceptions")
      .insert({ slot_id: slotId, date, student_id: null });
    if (error) throw new Error(error.message);
  }
}

/**
 * Считает баланс каждого ученика, у которого есть строки в lesson_payers.
 * consumed = Σ (прошедшие занятия слота между anchor и сегодня − отменённые) × цена.
 * balance = Σ платежей − consumed. Всё в копейках.
 */
export async function getStudentBalances(): Promise<StudentBalance[]> {
  const db = supabaseAdmin();
  const today = todayNN();

  const [payers, payments, exceptions, slots, students, billing] = await Promise.all([
    selectAll<LessonPayer>("lesson_payers"),
    selectAll<Payment>("payments"),
    selectAll<LessonException>("lesson_exceptions"),
    selectAll<Slot>("slots"),
    db.from("students").select("id, name").then((r) => (r.data ?? []) as { id: string; name: string }[]),
    selectAll<{ student_id: string; anchor_date: string }>("student_billing"),
  ]);

  const slotMap = new Map(slots.map((s) => [s.id, s]));
  const nameMap = new Map(students.map((s) => [s.id, s.name]));
  const anchorMap = new Map(billing.map((b) => [b.student_id, b.anchor_date]));

  // Кредиты по ученикам.
  const credited = new Map<string, number>();
  for (const p of payments) {
    credited.set(p.student_id, (credited.get(p.student_id) ?? 0) + p.amount_kopecks);
  }

  // Плательщики, сгруппированные по ученику.
  const byStudent = new Map<string, LessonPayer[]>();
  for (const p of payers) {
    const arr = byStudent.get(p.student_id) ?? [];
    arr.push(p);
    byStudent.set(p.student_id, arr);
  }

  const studentIds = new Set<string>([...byStudent.keys(), ...credited.keys()]);
  const result: StudentBalance[] = [];

  for (const studentId of studentIds) {
    const anchor = anchorMap.get(studentId) ?? today;
    const myPayers = byStudent.get(studentId) ?? [];

    let consumed = 0;
    let weeklyBurn = 0;
    for (const payer of myPayers) {
      const slot = slotMap.get(payer.slot_id);
      if (!slot) continue;
      weeklyBurn += payer.price_kopecks;

      const dates = weekdayDatesInRange(anchor, today, slot.weekday);
      const skips = new Set(
        exceptions
          .filter(
            (e) =>
              e.slot_id === payer.slot_id &&
              (e.student_id === null || e.student_id === studentId),
          )
          .map((e) => e.date),
      );
      const occurred = dates.filter((d) => !skips.has(d)).length;
      consumed += occurred * payer.price_kopecks;
    }

    const creditedK = credited.get(studentId) ?? 0;
    result.push({
      studentId,
      name: nameMap.get(studentId) ?? "—",
      creditedKopecks: creditedK,
      consumedKopecks: consumed,
      balanceKopecks: creditedK - consumed,
      weeklyBurnKopecks: weeklyBurn,
      lessonsPerWeek: myPayers.length,
      anchorDate: anchor,
    });
  }

  return result.sort((a, b) => a.name.localeCompare(b.name, "ru"));
}
