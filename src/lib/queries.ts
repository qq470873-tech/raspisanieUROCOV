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

/** Заявки всех детей household — для вкладки «Ваши заявки». */
export async function getBookingsForHousehold(
  householdId: string,
): Promise<BookingWithSlot[]> {
  const students = await getStudentsByHousehold(householdId);
  const ids = students.map((s) => s.id);
  if (ids.length === 0) return [];
  const db = supabaseAdmin();
  const { data } = await db
    .from("bookings")
    .select("*, slot:slots(*)")
    .in("student_id", ids)
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

/** Активная заявка (pending/confirmed/proposed) по каждому слоту. */
async function activeBookingsBySlot(): Promise<Map<string, Booking>> {
  const db = supabaseAdmin();
  const { data } = await db.from("bookings").select("*").in("status", ACTIVE_STATUSES);
  const map = new Map<string, Booking>();
  for (const b of (data ?? []) as Booking[]) map.set(b.slot_id, b);
  return map;
}

/** Все слоты + их активная заявка — для панели преподавателя. */
export async function getSlotsWithBookings(): Promise<SlotWithBooking[]> {
  const [slots, bySlot] = await Promise.all([listSlots(), activeBookingsBySlot()]);
  return slots.map((s) => ({ ...s, booking: bySlot.get(s.id) ?? null }));
}

/** Свободные слоты для страницы родителя (активные и без активной заявки). */
export async function getAvailableSlots(): Promise<Slot[]> {
  const [slots, bySlot] = await Promise.all([listSlots(), activeBookingsBySlot()]);
  return slots.filter((s) => s.is_active && !bySlot.has(s.id));
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
  | { ok: false; reason: "invalid_token" | "slot_unavailable" | "taken" | "forbidden" };

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
  const { data: slot } = await db
    .from("slots")
    .select("*")
    .eq("id", input.slot_id)
    .maybeSingle();
  if (!slot || !(slot as Slot).is_active) return { ok: false, reason: "slot_unavailable" };

  const { data, error } = await db
    .from("bookings")
    .insert({
      slot_id: input.slot_id,
      student_id: input.student_id,
      student_1: (student as Student).name,
      comment: input.comment || null,
      email: input.email || (student as Student).email || null,
      status: "pending",
      access_token: randomToken(),
    })
    .select("*")
    .single();

  if (error) {
    // 23505 — нарушение уникального индекса: слот уже занят активной заявкой.
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

export const confirmBooking = (id: string) => setStatus(id, "confirmed");
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
