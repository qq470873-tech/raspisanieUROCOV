import { notFound } from "next/navigation";
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
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Запись на занятия</h1>
        <p className="text-sm text-muted-foreground">
          Выберите удобное свободное время и укажите имя и фамилию ученика.
        </p>
      </header>
      <BookingClient token={token} slots={slots} />
    </main>
  );
}
