import {
  countUnseenForTeacher,
  getBookingToken,
  getSlotsWithBookings,
  listBookings,
} from "@/lib/queries";
import { env } from "@/lib/env";
import { DashboardShell } from "./shell";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [slots, bookings, token, unseen] = await Promise.all([
    getSlotsWithBookings(),
    listBookings(),
    getBookingToken(),
    countUnseenForTeacher(),
  ]);

  const bookingUrl = `${env.appUrl()}/book/${token}`;

  return (
    <DashboardShell
      slots={slots}
      bookings={bookings}
      bookingUrl={bookingUrl}
      unseen={unseen}
    />
  );
}
