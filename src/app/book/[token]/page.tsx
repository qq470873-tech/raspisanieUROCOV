import { notFound } from "next/navigation";
import { CalendarHeart } from "lucide-react";
import { getAvailableSlots, getBookingToken } from "@/lib/queries";
import { BookingClient } from "./booking-client";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const currentToken = await getBookingToken();
  if (token !== currentToken) notFound();

  const slots = await getAvailableSlots();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <header className="mb-8 flex flex-col items-center text-center">
        <span className="brand-badge mb-4 size-16">
          <CalendarHeart className="size-8" />
        </span>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
          Запись на <span className="text-gradient">занятия</span>
        </h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Выберите удобное свободное время — и укажите имя и фамилию ученика.
          Это займёт меньше минуты ✨
        </p>
      </header>
      <BookingClient token={token} slots={slots} />
    </main>
  );
}
