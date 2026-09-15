import { BookingsClosed } from "@/components/bookings-closed";

export const dynamic = "force-dynamic";

/**
 * Самозапись учеников отключена — проект стал личным CRM преподавателя.
 * Страница закрыта для всех (игнорирует токен ссылки и cookie личности).
 */
export default function BookPage() {
  return <BookingsClosed />;
}
