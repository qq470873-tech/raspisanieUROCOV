import { BookingsClosed } from "@/components/bookings-closed";

export const dynamic = "force-dynamic";

/** Страница статуса заявки ученика отключена вместе с самозаписью. */
export default function BookingStatusPage() {
  return <BookingsClosed />;
}
