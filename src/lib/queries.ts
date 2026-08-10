import "server-only";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "./supabase";
import {
  ACTIVE_STATUSES,
  type Booking,
  type Slot,
  type SlotWithBooking,
  rangesOverlap,
  timeToMinutes,
} from "./domain";
import type { SlotInput } from "./schemas";

function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export type BookingWithSlot = Booking & { slot: Slot };

/** ФИО ученика(ов) заявки одной строкой. */
export function bookingNames(b: Pick<Booking, "student_1" | "student_2">): string {
  return b.student_2 ? `${b.student_1} + ${b.student_2}` : b.student_1;
}

// ── Настройки / универсальная ссылка ────────────────────────────────────────────

/** Возвращает токен универсальной ссылки, создаёт настройки при первом вызове. */
export async function getBookingToken(): Promise<string> {
  const db = supabaseAdmin();
  const { data } = await db.from("settings").select("booking_token").eq("id", 1).maybeSingle();
  if (data?.booking_token) return data.booking_token;

  const token = randomToken();
  await db.from("settings").upsert({ id: 1, booking_token: token });
  return token;
}

/** Перевыпускает токен ссылки (старая ссылка перестаёт работать). */
export async function rotateBookingToken(): Promise<string> {
  const db = supabaseAdmin();
  const token = randomToken();
  await db.from("settings").upsert({ id: 1, booking_token: token });
  return token;
}

export async function isValidToken(token: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data } = await db.from("settings").select("booking_token").eq("id", 1).maybeSingle();
  return !!data?.booking_token && data.booking_token === token;
}

// ── Ученики (личность родителя/детей) ─────────────────────────────────────────────

export interface Student {
  id: string;
  name: string;
  email: string | null;
  household_id: string;
  created_at: string;
}

const norm = (s: string) => s.trim().toLowerCase();

/**
 * Регистрирует одного или двух детей: находит по имени существующих или создаёт
 * новых и объединяет их в одно household (для группировки братьев/сестёр).
 * Возвращает учеников и общий household_id.
 */
export async function registerStudents(
  names: string[],
  email?: string,
): Promise<{ students: Student[]; householdId: string }> {
  const db = supabaseAdmin();
  const { data: all } = await db.from("students").select("*");
  const existing = (all ?? []) as Student[];

  const result: Student[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const found = existing.find((s) => norm(s.name) === norm(name));
    if (found) {
      result.push(found);
    } else {
      const { data, error } = await db
        .from("students")
        .insert({ name, email: email || null })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const created = data as Student;
      existing.push(created);
      result.push(created);
    }
  }

  // Общий household: берём уже существующий у кого-то из детей, иначе — первого.
  const householdId = result[0]?.household_id ?? crypto.randomUUID();
  const ids = result.map((s) => s.id);
  if (ids.length > 0) {
    const patch: { household_id: string; email?: string } = { household_id: householdId };
    if (email) patch.email = email;
    await db.from("students").update(patch).in("id", ids);
  }
  return { students: result.map((s) => ({ ...s, household_id: householdId })), householdId };
}

export async function getStudentsByHousehold(householdId: string): Promise<Student[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("students")
    .select("*")
    .eq("household_id", householdId)
    .order("created_at");
  return (data ?? []) as Student[];
}

export async function getAllStudents(): Promise<Student[]> {
  const db = supabaseAdmin();
  const { data } = await db.from("students").select("*").order("name");
  return (data ?? []) as Student[];
}

/** Заявки всех детей household (как основной ученик ИЛИ как партнёр по паре). */
export async function getBookingsForHousehold(
  householdId: string,
): Promise<BookingWithSlot[]> {
  const students = await getStudentsByHousehold(householdId);
  const ids = students.map((s) => s.id);
  if (ids.length === 0) return [];
  const db = supabaseAdmin();
  const list = `(${ids.join(",")})`;
  const { data } = await db
    .from("bookings")
    .select("*, slot:slots(*)")
    .or(`student_id.in.${list},partner_student_id.in.${list}`)
    .order("created_at", { ascending: false });
  return (data ?? []) as BookingWithSlot[];
}

// ── Слоты ────────────────────────────────────────────────────────────────────────

function sortSlots<T extends Slot>(slots: T[]): T[] {
  return [...slots].sort(
    (a, b) => a.weekday - b.weekday || timeToMinutes(a.start_time) - timeToMinutes(b.start_time),
  );
}

export async function listSlots(): Promise<Slot[]> {
  const db = supabaseAdmin();
  const { data } = await db.from("slots").select("*");
  return sortSlots((data ?? []) as Slot[]);
}

/** Все активные заявки (pending/confirmed/proposed) вместе со слотом. */
async function activeBookingsWithSlot(): Promise<BookingWithSlot[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("bookings")
    .select("*, slot:slots(*)")
    .in("status", ACTIVE_STATUSES);
  return (data ?? []) as BookingWithSlot[];
}

/**
 * Все слоты для панели преподавателя. Для каждого слота:
 * booking — подтверждённая или предложенная заявка (если есть);
 * pendingCount — сколько заявок ожидают решения.
 */
export async function getSlotsWithBookings(): Promise<SlotWithBooking[]> {
  const [slots, active] = await Promise.all([listSlots(), activeBookingsWithSlot()]);
  return slots.map((s) => {
    const onSlot = active.filter((b) => b.slot_id === s.id);
    const primary =
      onSlot.find((b) => b.status === "confirmed") ??
      onSlot.find((b) => b.status === "proposed") ??
      null;
    const pendingCount = onSlot.filter((b) => b.status === "pending").length;
    return { ...s, booking: primary, pendingCount };
  });
}

/**
 * Свободные для записи слоты (страница ученика).
 * Заявки в ожидании НЕ блокируют время — недоступно только то, что пересекается
 * с подтверждённой записью.
 */
export async function getAvailableSlots(): Promise<Slot[]> {
  const [slots, active] = await Promise.all([listSlots(), activeBookingsWithSlot()]);
  const confirmed = active.filter((b) => b.status === "confirmed");
  return slots.filter(
    (s) =>
      s.is_active &&
      !confirmed.some(
        (b) =>
          b.slot.weekday === s.weekday &&
          rangesOverlap(s.start_time, s.end_time, b.slot.start_time, b.slot.end_time),
      ),
  );
}

export async function createSlots(inputs: SlotInput[]): Promise<void> {
  const db = supabaseAdmin();
  const rows = inputs.map((s) => ({
    weekday: s.weekday,
    start_time: s.start_time,
    end_time: s.end_time,
  }));
  const { error } = await db.from("slots").insert(rows);
  if (error) throw new Error(error.message);
}

export async function deleteSlot(id: string): Promise<void> {
  const db = supabaseAdmin();
  await db.from("slots").delete().eq("id", id);
}

export async function setSlotActive(id: string, isActive: boolean): Promise<void> {
  const db = supabaseAdmin();
  await db.from("slots").update({ is_active: isActive }).eq("id", id);
}

/** Меняет время существующего слота (сдвиг стрелками у преподавателя). */
export async function updateSlotTime(
  id: string,
  startTime: string,
  endTime: string,
): Promise<void> {
  const db = supabaseAdmin();
  const { error } = await db
    .from("slots")
    .update({ start_time: startTime, end_time: endTime })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// ── Заявки ─────────────────────────────────────────────────────────────────────

export async function listBookings(): Promise<BookingWithSlot[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("bookings")
    .select("*, slot:slots(*)")
    .order("created_at", { ascending: false });
  return (data ?? []) as BookingWithSlot[];
}

export interface CreateBookingInput {
  token: string;
  slot_id: string;
  student_id: string;
  householdId: string;
  comment?: string;
  email?: string;
}

export type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "invalid_token" | "slot_unavailable" | "taken" | "forbidden" | "duplicate" };

/** Создаёт заявку от родителя с проверкой токена, слота и принадлежности ученика. */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  if (!(await isValidToken(input.token))) return { ok: false, reason: "invalid_token" };

  const db = supabaseAdmin();

  // Ученик должен принадлежать текущему household (защита от подмены).
  const { data: student } = await db
    .from("students")
    .select("*")
    .eq("id", input.student_id)
    .maybeSingle();
  if (!student || (student as Student).household_id !== input.householdId) {
    return { ok: false, reason: "forbidden" };
  }

  // Слот должен существовать и быть активным.
  const { data: slotData } = await db
    .from("slots")
    .select("*")
    .eq("id", input.slot_id)
    .maybeSingle();
  const slot = slotData as Slot | null;
  if (!slot || !slot.is_active) return { ok: false, reason: "slot_unavailable" };

  // Время недоступно, только если пересекается с ПОДТВЕРЖДЁННОЙ записью.
  const active = await activeBookingsWithSlot();
  const confirmedClash = active.some(
    (b) =>
      b.status === "confirmed" &&
      b.slot.weekday === slot.weekday &&
      rangesOverlap(slot.start_time, slot.end_time, b.slot.start_time, b.slot.end_time),
  );
  if (confirmedClash) return { ok: false, reason: "taken" };

  // Тот же ученик уже подал активную заявку на этот слот.
  const dup = active.some(
    (b) =>
      b.slot_id === slot.id &&
      (b.student_id === input.student_id || b.partner_student_id === input.student_id),
  );
  if (dup) return { ok: false, reason: "duplicate" };

  const { data, error } = await db
    .from("bookings")
    .insert({
      slot_id: input.slot_id,
      student_id: input.student_id,
      student_1: student.name,
      comment: input.comment || null,
      email: input.email || student.email || null,
      status: "pending",
      access_token: randomToken(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") return { ok: false, reason: "taken" };
    throw new Error(error.message);
  }
  return { ok: true, booking: data as Booking };
}

export async function getBookingById(id: string): Promise<BookingWithSlot | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("bookings")
    .select("*, slot:slots(*)")
    .eq("id", id)
    .maybeSingle();
  return (data as BookingWithSlot) ?? null;
}

export async function getBookingByToken(
  accessToken: string,
): Promise<BookingWithSlot | null> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("bookings")
    .select("*, slot:slots(*)")
    .eq("access_token", accessToken)
    .maybeSingle();
  return (data as BookingWithSlot) ?? null;
}

async function setStatus(bookingId: string, status: Booking["status"]): Promise<void> {
  const db = supabaseAdmin();
  await db.from("bookings").update({ status, student_seen: false }).eq("id", bookingId);
}

/**
 * Подтверждает заявку и автоматически отклоняет все остальные активные заявки
 * (ожидающие/предложенные), чьё время пересекается. Возвращает отклонённые —
 * чтобы уведомить этих учеников.
 */
export async function confirmBooking(bookingId: string): Promise<{ rejected: BookingWithSlot[] }> {
  const db = supabaseAdmin();
  const booking = await getBookingById(bookingId);
  if (!booking) return { rejected: [] };

  const active = await activeBookingsWithSlot();
  const clashing = active.filter(
    (b) =>
      b.id !== bookingId &&
      (b.status === "pending" || b.status === "proposed") &&
      b.slot.weekday === booking.slot.weekday &&
      rangesOverlap(
        booking.slot.start_time,
        booking.slot.end_time,
        b.slot.start_time,
        b.slot.end_time,
      ),
  );
  if (clashing.length > 0) {
    await db
      .from("bookings")
      .update({ status: "rejected", student_seen: false })
      .in(
        "id",
        clashing.map((b) => b.id),
      );
  }
  await setStatus(bookingId, "confirmed");
  return { rejected: clashing };
}

export const rejectBooking = (id: string) => setStatus(id, "rejected");
export const cancelBooking = (id: string) => setStatus(id, "cancelled");

export async function deleteBooking(id: string): Promise<void> {
  const db = supabaseAdmin();
  await db.from("bookings").delete().eq("id", id);
}

export type MoveResult =
  | { ok: true }
  | { ok: false; reason: "taken" | "slot_unavailable" }
  | { ok: false; reason: "overlap"; conflicts: string[] };

/**
 * Активные заявки, чьё время пересекается с заданным интервалом того же дня.
 * Исключает саму переносимую заявку.
 */
export async function findOverlappingBookings(
  weekday: number,
  startTime: string,
  endTime: string,
  excludeBookingId: string,
): Promise<BookingWithSlot[]> {
  const db = supabaseAdmin();
  const { data } = await db
    .from("bookings")
    .select("*, slot:slots(*)")
    .in("status", ACTIVE_STATUSES);
  return ((data ?? []) as BookingWithSlot[]).filter(
    (b) =>
      b.id !== excludeBookingId &&
      b.slot.weekday === weekday &&
      rangesOverlap(startTime, endTime, b.slot.start_time, b.slot.end_time),
  );
}

export interface MoveBookingInput {
  bookingId: string;
  mode: "move" | "propose";
  targetSlotId?: string;
  customTime?: { weekday: number; start_time: string; end_time: string };
  force?: boolean;
}

/**
 * Переносит заявку в другой слот или в заданное вручную время.
 * mode "move" — сразу переносит (confirmed); "propose" — предлагает ученику (proposed).
 * Для custom-времени создаётся новый слот. При пересечении с чужой активной
 * записью и force=false возвращает reason "overlap" со списком имён.
 */
export async function moveBooking(input: MoveBookingInput): Promise<MoveResult> {
  const db = supabaseAdmin();
  const { bookingId, mode, targetSlotId, customTime, force } = input;

  // Определяем целевое время (день + интервал).
  let weekday: number;
  let startTime: string;
  let endTime: string;

  if (customTime) {
    weekday = customTime.weekday;
    startTime = customTime.start_time;
    endTime = customTime.end_time;
  } else if (targetSlotId) {
    const { data: slot } = await db
      .from("slots")
      .select("*")
      .eq("id", targetSlotId)
      .maybeSingle();
    if (!slot || !(slot as Slot).is_active) return { ok: false, reason: "slot_unavailable" };
    weekday = (slot as Slot).weekday;
    startTime = (slot as Slot).start_time;
    endTime = (slot as Slot).end_time;
  } else {
    return { ok: false, reason: "slot_unavailable" };
  }

  // Проверка пересечений (если не forced).
  if (!force) {
    const conflicts = await findOverlappingBookings(weekday, startTime, endTime, bookingId);
    if (conflicts.length > 0) {
      return { ok: false, reason: "overlap", conflicts: conflicts.map(bookingNames) };
    }
  }

  // Для custom-времени создаём новый слот.
  let slotId = targetSlotId;
  if (customTime) {
    const { data: newSlot, error: slotErr } = await db
      .from("slots")
      .insert({ weekday, start_time: startTime, end_time: endTime, is_active: true })
      .select("*")
      .single();
    if (slotErr) throw new Error(slotErr.message);
    slotId = (newSlot as Slot).id;
  }

  const { error } = await db
    .from("bookings")
    .update({
      slot_id: slotId,
      status: mode === "move" ? "confirmed" : "proposed",
      student_seen: false,
    })
    .eq("id", bookingId);

  if (error) {
    if (error.code === "23505") return { ok: false, reason: "taken" };
    throw new Error(error.message);
  }
  return { ok: true };
}

export type PairResult =
  | { ok: true; booking: BookingWithSlot; partner: Student }
  | { ok: false; reason: "not_found" | "self" };

/** Делает занятие парным: привязывает второго ученика к заявке. */
export async function setBookingPartner(
  bookingId: string,
  partner: { studentId?: string; name?: string },
): Promise<PairResult> {
  const db = supabaseAdmin();
  const booking = await getBookingById(bookingId);
  if (!booking) return { ok: false, reason: "not_found" };

  let student: Student | null = null;
  if (partner.studentId) {
    const { data } = await db.from("students").select("*").eq("id", partner.studentId).maybeSingle();
    student = (data as Student) ?? null;
  } else if (partner.name && partner.name.trim()) {
    const { students } = await registerStudents([partner.name.trim()]);
    student = students[0] ?? null;
  }
  if (!student) return { ok: false, reason: "not_found" };
  if (student.id === booking.student_id) return { ok: false, reason: "self" };

  const { error } = await db
    .from("bookings")
    .update({ partner_student_id: student.id, student_2: student.name })
    .eq("id", bookingId);
  if (error) throw new Error(error.message);

  const updated = await getBookingById(bookingId);
  return { ok: true, booking: updated as BookingWithSlot, partner: student };
}

/** Ответ ученика на предложенное время. */
export async function respondToProposal(
  accessToken: string,
  accept: boolean,
): Promise<{ ok: boolean }> {
  const booking = await getBookingByToken(accessToken);
  if (!booking || booking.status !== "proposed") return { ok: false };
  await setStatus(booking.id, accept ? "confirmed" : "rejected");
  return { ok: true };
}

// ── Уведомления преподавателя (непросмотренные заявки) ──────────────────────────

export async function countUnseenForTeacher(): Promise<number> {
  const db = supabaseAdmin();
  const { count } = await db
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("teacher_seen", false)
    .eq("status", "pending");
  return count ?? 0;
}

export async function markAllTeacherSeen(): Promise<void> {
  const db = supabaseAdmin();
  await db.from("bookings").update({ teacher_seen: true }).eq("teacher_seen", false);
}
