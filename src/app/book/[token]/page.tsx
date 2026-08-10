import { notFound } from "next/navigation";
import { CalendarHeart } from "lucide-react";
import {
  getAvailableSlots,
  getBookingToken,
  getBookingsForHousehold,
  getStudentsByHousehold,
} from "@/lib/queries";
import { getHouseholdId } from "@/lib/student-session";
import { RegisterClient } from "./register-client";
import { StudentApp } from "./student-app";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const currentToken = await getBookingToken();
  if (token !== currentToken) notFound();

  const householdId = await getHouseholdId();
  const students = householdId ? await getStudentsByHousehold(householdId) : [];
  const registered = students.length > 0;

  const [slots, bookings] = registered
    ? await Promise.all([getAvailableSlots(), getBookingsForHousehold(householdId!)])
    : [[], []];

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
          {registered
            ? "Выберите удобное свободное время. Ваши заявки — на соседней вкладке."
            : "Как зовут ученика? Укажите имя и фамилию — это займёт меньше минуты ✨"}
        </p>
      </header>

      {registered ? (
        <StudentApp
          token={token}
          students={students.map((s) => ({ id: s.id, name: s.name }))}
          slots={slots}
          bookings={bookings}
        />
      ) : (
        <RegisterClient token={token} />
      )}
    </main>
  );
}
