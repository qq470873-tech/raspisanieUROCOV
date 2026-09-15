import "server-only";
import { supabaseAdmin } from "./supabase";
import type { Slot } from "./domain";
import { timeToMinutes } from "./domain";
import { registerStudents } from "./queries";
import { addDays, mondayOf, todayNN, weekdayDatesInRange } from "./time-nn";

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

/** Начало учебного «сезона» — с этой недели можно листать денежное расписание. */
export const SEASON_START = "2026-09-01";

/** Сводка по счёту ученика (модель «баланс»). */
export interface StudentBalance {
  studentId: string;
  name: string;
  creditedKopecks: number;
  consumedKopecks: number;
  balanceKopecks: number;
  weeklyBurnKopecks: number;
  lessonsPerWeek: number;
  anchorDate: string;
}

async function selectAll<T>(table: string): Promise<T[]> {
  const db = supabaseAdmin();
  const { data } = await db.from(table).select("*");
  return (data ?? []) as T[];
}

// ── Плательщики из расписания ──────────────────────────────────────────────────
// Плательщики берутся из подтверждённых броней (реальное расписание), а
// lesson_payers хранит только переопределения цены и дополнительных плательщиков.

interface FlatPayer {
  slot: Slot;
  student_id: string;
  name: string;
  price_kopecks: number;
  source: "schedule" | "extra";
}

interface ConfirmedBooking {
  slot_id: string;
  student_id: string | null;
  partner_student_id: string | null;
  partner2_student_id: string | null;
}

async function getFlatPayers(): Promise<{
  flat: FlatPayer[];
  activeSlots: Slot[];
  students: { id: string; name: string }[];
  defaultPriceKopecks: number;
}> {
  const db = supabaseAdmin();
  const [slots, overrides, students, settings, bookings] = await Promise.all([
    selectAll<Slot>("slots"),
    selectAll<LessonPayer>("lesson_payers"),
    db.from("students").select("id, name").then((r) => (r.data ?? []) as { id: string; name: string }[]),
    db.from("settings").select("default_price_kopecks").eq("id", 1).maybeSingle(),
    db
      .from("bookings")
      .select("slot_id, student_id, partner_student_id, partner2_student_id")
      .eq("status", "confirmed")
      .then((r) => (r.data ?? []) as ConfirmedBooking[]),
  ]);

  const defaultPrice =
    (settings.data as { default_price_kopecks: number } | null)?.default_price_kopecks ?? 0;
  const nameMap = new Map(students.map((s) => [s.id, s.name]));
  const priceMap = new Map(overrides.map((o) => [`${o.slot_id}|${o.student_id}`, o.price_kopecks]));
  const activeSlots = slots
    .filter((s) => s.is_active)
    .sort((a, b) => a.weekday - b.weekday || timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

  const flat: FlatPayer[] = [];
  for (const slot of activeSlots) {
    const seen = new Set<string>();
    const price = (studentId: string) =>
      priceMap.get(`${slot.id}|${studentId}`) ?? defaultPrice;

    // Участники подтверждённых броней на этом слоте.
    for (const b of bookings.filter((x) => x.slot_id === slot.id)) {
      for (const id of [b.student_id, b.partner_student_id, b.partner2_student_id]) {
        if (!id || seen.has(id)) continue;
        seen.add(id);
        flat.push({
          slot,
          student_id: id,
          name: nameMap.get(id) ?? "—",
          price_kopecks: price(id),
          source: "schedule",
        });
      }
    }
    // Дополнительные плательщики (не участники брони).
    for (const o of overrides.filter((x) => x.slot_id === slot.id)) {
      if (seen.has(o.student_id)) continue;
      seen.add(o.student_id);
      flat.push({
        slot,
        student_id: o.student_id,
        name: nameMap.get(o.student_id) ?? "—",
        price_kopecks: o.price_kopecks,
        source: "extra",
      });
    }
  }

  return { flat, activeSlots, students, defaultPriceKopecks: defaultPrice };
}

// ── Настройка стоимости (раздел 3) ─────────────────────────────────────────────

export interface SlotPayerView {
  student_id: string;
  name: string;
  price_kopecks: number;
  source: "schedule" | "extra";
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

export async function getPricingData(): Promise<PricingData> {
  const { flat, activeSlots, students, defaultPriceKopecks } = await getFlatPayers();
  const bySlot = new Map<string, FlatPayer[]>();
  for (const p of flat) {
    const arr = bySlot.get(p.slot.id) ?? [];
    arr.push(p);
    bySlot.set(p.slot.id, arr);
  }

  return {
    defaultPriceKopecks,
    students: [...students].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    slots: activeSlots.map((s) => ({
      id: s.id,
      weekday: s.weekday,
      start_time: s.start_time,
      end_time: s.end_time,
      is_active: s.is_active,
      payers: (bySlot.get(s.id) ?? [])
        .map((p) => ({
          student_id: p.student_id,
          name: p.name,
          price_kopecks: p.price_kopecks,
          source: p.source,
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),
    })),
  };
}

/** Задаёт/обновляет цену плательщика на слоте (переопределение). */
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

/** Добавляет доп. плательщика по имени (создаёт ученика при необходимости). */
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

/** Убирает переопределение/доп. плательщика со слота (участник брони останется по дефолтной цене). */
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
  const { error } = await db.from("settings").upsert({ id: 1, default_price_kopecks: priceKopecks });
  if (error) throw new Error(error.message);
}

/** Создаёт строку биллинга ученику, если её ещё нет (anchor = сегодня по НН). */
export async function ensureBilling(studentId: string): Promise<void> {
  const db = supabaseAdmin();
  await db
    .from("student_billing")
    .upsert({ student_id: studentId }, { onConflict: "student_id", ignoreDuplicates: true });
}

// ── Баланс (модель А), с расчётом «на дату» ────────────────────────────────────

/**
 * Баланс каждого ученика на дату asOf (по умолчанию — сегодня по НН).
 * consumed = Σ (прошедшие занятия слота между anchor и asOf − отменённые) × цена.
 * credited = Σ платежей с paid_at ≤ asOf. balance = credited − consumed.
 */
export async function getStudentBalances(asOf: string = todayNN()): Promise<StudentBalance[]> {
  const [{ flat, students }, payments, exceptions, billing] = await Promise.all([
    getFlatPayers(),
    selectAll<Payment>("payments"),
    selectAll<LessonException>("lesson_exceptions"),
    selectAll<{ student_id: string; anchor_date: string }>("student_billing"),
  ]);

  const nameMap = new Map(students.map((s) => [s.id, s.name]));
  const anchorMap = new Map(billing.map((b) => [b.student_id, b.anchor_date]));

  const credited = new Map<string, number>();
  for (const p of payments) {
    if (p.paid_at <= asOf) credited.set(p.student_id, (credited.get(p.student_id) ?? 0) + p.amount_kopecks);
  }

  const byStudent = new Map<string, FlatPayer[]>();
  for (const p of flat) {
    const arr = byStudent.get(p.student_id) ?? [];
    arr.push(p);
    byStudent.set(p.student_id, arr);
  }

  const studentIds = new Set<string>([...byStudent.keys(), ...credited.keys()]);
  const result: StudentBalance[] = [];

  for (const studentId of studentIds) {
    const anchor = anchorMap.get(studentId) ?? todayNN();
    const myPayers = byStudent.get(studentId) ?? [];

    let consumed = 0;
    let weeklyBurn = 0;
    for (const payer of myPayers) {
      weeklyBurn += payer.price_kopecks;
      const dates = weekdayDatesInRange(anchor, asOf, payer.slot.weekday);
      const skips = new Set(
        exceptions
          .filter(
            (e) =>
              e.slot_id === payer.slot.id && (e.student_id === null || e.student_id === studentId),
          )
          .map((e) => e.date),
      );
      consumed += dates.filter((d) => !skips.has(d)).length * payer.price_kopecks;
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

// ── Оплата занятий (раздел 2) ──────────────────────────────────────────────────

export interface PaymentsStudent extends StudentBalance {
  perLessonKopecks: number;
  lessonsLeft: number | null;
  payments: Payment[];
}

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
    const perLesson = b.lessonsPerWeek > 0 ? Math.round(b.weeklyBurnKopecks / b.lessonsPerWeek) : 0;
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

/** Полная история изменений баланса ученика: платежи (+) и списания за занятия (−). */
export interface LedgerEntry {
  date: string;
  label: string;
  amountKopecks: number; // + пополнение, − списание
}

export async function getStudentLedger(studentId: string): Promise<LedgerEntry[]> {
  const [{ flat }, payments, exceptions, billing] = await Promise.all([
    getFlatPayers(),
    selectAll<Payment>("payments"),
    selectAll<LessonException>("lesson_exceptions"),
    selectAll<{ student_id: string; anchor_date: string }>("student_billing"),
  ]);

  const today = todayNN();
  const anchor = billing.find((b) => b.student_id === studentId)?.anchor_date ?? today;
  const entries: LedgerEntry[] = [];

  // Пополнения / корректировки.
  for (const p of payments.filter((x) => x.student_id === studentId)) {
    entries.push({ date: p.paid_at, label: p.note || "Оплата", amountKopecks: p.amount_kopecks });
  }

  // Списания за прошедшие занятия.
  for (const payer of flat.filter((x) => x.student_id === studentId)) {
    const skips = new Set(
      exceptions
        .filter((e) => e.slot_id === payer.slot.id && (e.student_id === null || e.student_id === studentId))
        .map((e) => e.date),
    );
    for (const d of weekdayDatesInRange(anchor, today, payer.slot.weekday)) {
      if (skips.has(d)) continue;
      entries.push({
        date: d,
        label: `Занятие ${payer.slot.start_time.slice(0, 5)}`,
        amountKopecks: -payer.price_kopecks,
      });
    }
  }

  // Свежие сверху.
  return entries.sort((a, b) => (a.date === b.date ? 0 : b.date.localeCompare(a.date)));
}

export async function setBalanceManual(studentId: string, targetKopecks: number): Promise<void> {
  const balances = await getStudentBalances();
  const cur = balances.find((b) => b.studentId === studentId)?.balanceKopecks ?? 0;
  const delta = Math.round(targetKopecks) - cur;
  if (delta === 0) return;
  await addPayment(studentId, delta, todayNN(), "Ручная корректировка остатка");
}

// ── Денежное расписание (раздел 1) — по неделям ────────────────────────────────

export interface MoneyPayer {
  student_id: string;
  name: string;
  price_kopecks: number;
  balanceKopecks: number;
  status: "paid" | "debt";
}

export interface MoneySlot {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
  date: string; // дата этого занятия в выбранной неделе
  skipped: boolean; // «урока не было» на эту дату
  payers: MoneyPayer[];
}

export interface MoneyScheduleData {
  weekMonday: string;
  slots: MoneySlot[];
  seasonStartMonday: string;
}

/** Денежное расписание на неделю (Пн = weekMonday). Баланс — на конец этой недели. */
export async function getMoneySchedule(weekMonday: string): Promise<MoneyScheduleData> {
  const asOf = addDays(weekMonday, 6);
  const [{ flat, activeSlots }, balances, exceptions] = await Promise.all([
    getFlatPayers(),
    getStudentBalances(asOf),
    selectAll<LessonException>("lesson_exceptions"),
  ]);
  const balMap = new Map(balances.map((b) => [b.studentId, b.balanceKopecks]));
  const bySlot = new Map<string, FlatPayer[]>();
  for (const p of flat) {
    const arr = bySlot.get(p.slot.id) ?? [];
    arr.push(p);
    bySlot.set(p.slot.id, arr);
  }

  const slots: MoneySlot[] = activeSlots.map((s) => {
    const date = addDays(weekMonday, s.weekday - 1);
    return {
      id: s.id,
      weekday: s.weekday,
      start_time: s.start_time,
      end_time: s.end_time,
      date,
      skipped: exceptions.some((e) => e.slot_id === s.id && e.student_id === null && e.date === date),
      payers: (bySlot.get(s.id) ?? []).map((p) => {
        const bal = balMap.get(p.student_id) ?? 0;
        return {
          student_id: p.student_id,
          name: p.name,
          price_kopecks: p.price_kopecks,
          balanceKopecks: bal,
          status: (bal >= p.price_kopecks ? "paid" : "debt") as "paid" | "debt",
        };
      }),
    };
  });

  return { weekMonday, slots, seasonStartMonday: mondayOf(SEASON_START) };
}

/** Отмечает/снимает «урока не было» для всего слота на дату (идемпотентно). */
export async function setException(slotId: string, date: string, on: boolean): Promise<void> {
  const db = supabaseAdmin();
  await db.from("lesson_exceptions").delete().eq("slot_id", slotId).eq("date", date).is("student_id", null);
  if (on) {
    const { error } = await db
      .from("lesson_exceptions")
      .insert({ slot_id: slotId, date, student_id: null });
    if (error) throw new Error(error.message);
  }
}
