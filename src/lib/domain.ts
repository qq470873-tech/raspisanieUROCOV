/**
 * Доменные типы и утилиты. Модель — повторяющаяся неделя:
 * слот = день недели (1–7) + время начала/конца, без календарных дат.
 */

export type BookingStatus =
  | "pending" // ожидает подтверждения
  | "confirmed" // подтверждено, слот занят
  | "rejected" // отклонено
  | "proposed" // преподаватель предложил другое время, ждём ответа ученика
  | "cancelled"; // слот освобождён

/** Статусы, при которых слот считается занятым (недоступен для брони). */
export const ACTIVE_STATUSES: BookingStatus[] = ["pending", "confirmed", "proposed"];

export interface Slot {
  id: string;
  weekday: number; // 1 = Пн ... 7 = Вс
  start_time: string; // "HH:MM:SS" из Postgres time
  end_time: string;
  is_active: boolean;
  created_at: string;
}

export interface Booking {
  id: string;
  slot_id: string;
  student_1: string;
  student_2: string | null;
  comment: string | null;
  email: string | null;
  status: BookingStatus;
  access_token: string;
  teacher_seen: boolean;
  student_seen: boolean;
  created_at: string;
  updated_at: string;
}

/** Слот вместе с активной заявкой (если есть). */
export interface SlotWithBooking extends Slot {
  booking: Booking | null;
}

export const WEEKDAYS: { value: number; short: string; long: string }[] = [
  { value: 1, short: "Пн", long: "Понедельник" },
  { value: 2, short: "Вт", long: "Вторник" },
  { value: 3, short: "Ср", long: "Среда" },
  { value: 4, short: "Чт", long: "Четверг" },
  { value: 5, short: "Пт", long: "Пятница" },
  { value: 6, short: "Сб", long: "Суббота" },
  { value: 7, short: "Вс", long: "Воскресенье" },
];

export function weekdayLong(weekday: number): string {
  return WEEKDAYS.find((d) => d.value === weekday)?.long ?? "—";
}

export function weekdayShort(weekday: number): string {
  return WEEKDAYS.find((d) => d.value === weekday)?.short ?? "—";
}

/** "08:15:00" -> "08:15" */
export function formatTime(time: string): string {
  return time.slice(0, 5);
}

/** Диапазон времени для отображения: "08:15–09:15" */
export function formatRange(start: string, end: string): string {
  return `${formatTime(start)}–${formatTime(end)}`;
}

/** Нормализует ввод времени "8:15" / "08:15" -> "08:15" для сравнения/хранения. */
export function normalizeTime(input: string): string {
  const [h, m] = input.split(":");
  return `${h.padStart(2, "0")}:${(m ?? "00").padStart(2, "0")}`;
}

/** Минуты от полуночи для сортировки/сравнения слотов. */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export const STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "Ожидает подтверждения",
  confirmed: "Подтверждено",
  rejected: "Отклонено",
  proposed: "Предложено другое время",
  cancelled: "Отменено",
};
