/**
 * Время по Нижнему Новгороду (Europe/Moscow, UTC+3, без перехода на летнее время).
 * Сервер Vercel живёт в UTC, поэтому «сегодня» считаем явно по этому поясу,
 * а не по браузеру пользователя.
 */

export const NN_TZ = "Europe/Moscow";

/** Сегодняшняя календарная дата в НН как "YYYY-MM-DD". */
export function todayNN(): string {
  // en-CA даёт формат YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: NN_TZ }).format(new Date());
}

/** "YYYY-MM-DD" -> день недели 1..7 (Пн..Вс), стабильно через UTC. */
export function weekdayOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Вс..6=Сб
  return dow === 0 ? 7 : dow;
}

/** Число дней между датами (to - from) по календарю. */
export function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const a = Date.UTC(fy, fm - 1, fd);
  const b = Date.UTC(ty, tm - 1, td);
  return Math.round((b - a) / 86_400_000);
}

/**
 * Сколько раз день недели `weekday` (1..7) встречается в диапазоне [from, to]
 * включительно. Возвращает 0, если from позже to.
 */
export function countWeekdayOccurrences(from: string, to: string, weekday: number): number {
  const total = daysBetween(from, to);
  if (total < 0) return 0;
  // Смещение от from до первого нужного дня недели.
  const startDow = weekdayOf(from);
  const offset = (weekday - startDow + 7) % 7;
  if (offset > total) return 0;
  return Math.floor((total - offset) / 7) + 1;
}

/** Все даты (YYYY-MM-DD) с данным днём недели в диапазоне [from, to] включительно. */
export function weekdayDatesInRange(from: string, to: string, weekday: number): string[] {
  const total = daysBetween(from, to);
  if (total < 0) return [];
  const startDow = weekdayOf(from);
  const offset = (weekday - startDow + 7) % 7;
  const [fy, fm, fd] = from.split("-").map(Number);
  const base = Date.UTC(fy, fm - 1, fd);
  const out: string[] = [];
  for (let delta = offset; delta <= total; delta += 7) {
    const dt = new Date(base + delta * 86_400_000);
    out.push(dt.toISOString().slice(0, 10));
  }
  return out;
}

/** Сдвиг даты "YYYY-MM-DD" на n дней. */
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + n * 86_400_000).toISOString().slice(0, 10);
}

/** Дата заданного дня недели (1..7) в текущей неделе по НН (неделя начинается с Пн). */
export function dateForWeekdayThisWeek(weekday: number): string {
  const today = todayNN();
  const monday = addDays(today, -(weekdayOf(today) - 1));
  return addDays(monday, weekday - 1);
}

/** Понедельник недели, в которую попадает дата. */
export function mondayOf(dateStr: string): string {
  return addDays(dateStr, -(weekdayOf(dateStr) - 1));
}

/** Понедельник текущей недели по НН. */
export function currentWeekMonday(): string {
  return mondayOf(todayNN());
}

/** "YYYY-MM-DD" -> "8 сен" для компактного показа. */
export function formatDayMonth(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** Копейки -> "1 000 ₽" (без копеек, если их нет). */
export function formatMoney(kopecks: number): string {
  const rub = kopecks / 100;
  const s = Number.isInteger(rub)
    ? rub.toLocaleString("ru-RU")
    : rub.toLocaleString("ru-RU", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${s} ₽`;
}
