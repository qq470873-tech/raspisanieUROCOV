import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { listBookings } from "@/lib/queries";
import { WEEKDAYS, formatRange, timeToMinutes } from "@/lib/domain";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

function names(b: { student_1: string; student_2: string | null }) {
  return b.student_2 ? `${b.student_1} + ${b.student_2}` : b.student_1;
}

export default async function PrintPage() {
  const bookings = await listBookings();
  const confirmed = bookings.filter((b) => b.status === "confirmed");

  const byDay = WEEKDAYS.map((d) => ({
    ...d,
    items: confirmed
      .filter((b) => b.slot.weekday === d.value)
      .sort((a, b) => timeToMinutes(a.slot.start_time) - timeToMinutes(b.slot.start_time)),
  }));

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> Назад
        </Link>
        <PrintButton />
      </div>

      <h1 className="mb-6 text-2xl font-bold tracking-tight">Расписание на неделю</h1>

      <div className="flex flex-col gap-5">
        {byDay.map((day) => (
          <div key={day.value} className="break-inside-avoid">
            <h2 className="mb-2 border-b border-border pb-1 text-lg font-semibold">{day.long}</h2>
            {day.items.length === 0 ? (
              <p className="text-sm text-muted-foreground">—</p>
            ) : (
              <ul className="flex flex-col gap-1">
                {day.items.map((b) => (
                  <li key={b.id} className="flex items-baseline gap-3">
                    <span className="w-28 shrink-0 font-semibold tabular-nums">
                      {formatRange(b.slot.start_time, b.slot.end_time)}
                    </span>
                    <span>{names(b)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </main>
  );
}
