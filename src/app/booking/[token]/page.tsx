import { notFound } from "next/navigation";
import { getBookingByToken } from "@/lib/queries";
import { STATUS_LABELS, formatRange, weekdayLong } from "@/lib/domain";
import { Card } from "@/components/ui/card";
import { ProposalActions } from "./proposal-actions";

export const dynamic = "force-dynamic";

const BANNER: Record<string, { title: string; className: string; bar: string }> = {
  pending: { title: "⏳ Заявка ожидает подтверждения", className: "text-amber-600", bar: "bg-amber-400" },
  confirmed: { title: "✅ Запись подтверждена", className: "text-emerald-600", bar: "bg-emerald-400" },
  rejected: { title: "❌ Заявка отклонена", className: "text-red-600", bar: "bg-red-400" },
  proposed: { title: "📩 Вам предложили другое время", className: "text-sky-600", bar: "bg-sky-400" },
  cancelled: { title: "Запись отменена", className: "text-muted-foreground", bar: "bg-muted-foreground/40" },
};

export default async function BookingStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const booking = await getBookingByToken(token);
  if (!booking) notFound();

  const names = booking.student_2
    ? `${booking.student_1} + ${booking.student_2}`
    : booking.student_1;
  const banner = BANNER[booking.status];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-8">
      <Card className="w-full p-0 shadow-xl shadow-primary/5">
        <div className={`h-1.5 w-full ${banner.bar}`} />
        <div className="p-6 pt-5">
        <h1 className={`text-lg font-semibold ${banner.className}`}>{banner.title}</h1>

        <dl className="mt-4 flex flex-col gap-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Ученик</dt>
            <dd className="font-medium">{names}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">
              {booking.status === "proposed" ? "Предложено" : "Время"}
            </dt>
            <dd className="font-medium">
              {weekdayLong(booking.slot.weekday)},{" "}
              {formatRange(booking.slot.start_time, booking.slot.end_time)}
            </dd>
          </div>
          {booking.comment && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Комментарий</dt>
              <dd className="max-w-[60%] text-right">{booking.comment}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Статус</dt>
            <dd>{STATUS_LABELS[booking.status]}</dd>
          </div>
        </dl>

        {booking.status === "proposed" && <ProposalActions accessToken={booking.access_token} />}

        <p className="mt-6 text-xs text-muted-foreground">
          Сохраните эту страницу в закладки, чтобы отслеживать статус записи.
        </p>
        </div>
      </Card>
    </main>
  );
}
