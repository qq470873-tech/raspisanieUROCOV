import "server-only";
import { randomBytes } from "crypto";
import { supabaseAdmin } from "./supabase";
import {
  ACTIVE_STATUSES,
  type Booking,
  type Slot,
  type SlotWithBooking,
  timeToMinutes,
} from "./domain";
import type { SlotInput } from "./schemas";

function randomToken(bytes = 16): string {
  return randomBytes(bytes).toString("hex");
}

export type BookingWithSlot = Booking & { slot: Slot };

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

async function isValidToken(token: string): Promise<boolean> {
  const db = supabaseAdmin();
  const { data } = await db.from("settings").select("booking_token").eq("id", 1).maybeSingle();
  return !!data?.booking_token && data.booking_token === token;
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
  student_1: string;
  student_2?: string;
  comment?: string;
  email?: string;
}

export type CreateBookingResult =
  | { ok: true; booking: Booking }
  | { ok: false; reason: "invalid_token" | "slot_unavailable" | "taken" };

/** Создаёт заявку от родителя с проверкой токена и доступности слота. */
export async function createBooking(input: CreateBookingInput): Promise<CreateBookingResult> {
  if (!(await isValidToken(input.token))) return { ok: false, reason: "invalid_token" };

  const db = supabaseAdmin();

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
      student_1: input.student_1,
      student_2: input.student_2 || null,
      comment: input.comment || null,
      email: input.email || null,
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

export type MoveResult = { ok: true } | { ok: false; reason: "taken" | "slot_unavailable" };

/**
 * Переносит заявку в другой слот.
 * mode "move" — сразу переносит (статус confirmed).
 * mode "propose" — предлагает ученику (статус proposed, ждём ответа).
 */
export async function moveBooking(
  bookingId: string,
  targetSlotId: string,
  mode: "move" | "propose",
): Promise<MoveResult> {
  const db = supabaseAdmin();

  const { data: slot } = await db
    .from("slots")
    .select("*")
    .eq("id", targetSlotId)
    .maybeSingle();
  if (!slot || !(slot as Slot).is_active) return { ok: false, reason: "slot_unavailable" };

  const { error } = await db
    .from("bookings")
    .update({
      slot_id: targetSlotId,
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
