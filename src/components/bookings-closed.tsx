import { Lock } from "lucide-react";
import { Card } from "@/components/ui/card";

/** Экран-заглушка: самозапись учеников отключена (проект стал личным CRM). */
export function BookingsClosed() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 items-center px-4 py-16">
      <Card className="flex w-full flex-col items-center gap-3 p-10 text-center">
        <span className="brand-badge size-14">
          <Lock className="size-7" />
        </span>
        <h1 className="text-xl font-semibold">Онлайн-запись закрыта</h1>
        <p className="text-sm text-muted-foreground">
          Запись на занятия больше не ведётся через сайт. Пожалуйста, свяжитесь с
          преподавателем напрямую.
        </p>
      </Card>
    </main>
  );
}
