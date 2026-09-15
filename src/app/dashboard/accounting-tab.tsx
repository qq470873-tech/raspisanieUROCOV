"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { apiPost } from "@/lib/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PricingSection } from "./accounting/pricing-section";
import { PaymentsSection } from "./accounting/payments-section";
import { MoneyScheduleSection } from "./accounting/money-schedule-section";

type Status = "checking" | "locked" | "unlocked";

export function AccountingTab() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    // Авто-разблокировка, если действует 30-мин кука (галочка «не спрашивать»).
    fetch("/api/accounting/unlock")
      .then((r) => (r.ok ? r.json() : { unlocked: false, persist: false }))
      .then((d) => setStatus(d.unlocked && d.persist ? "unlocked" : "locked"))
      .catch(() => setStatus("locked"));
  }, []);

  if (status === "checking") {
    return <Card className="p-8 text-center text-muted-foreground">Проверка доступа…</Card>;
  }
  if (status === "locked") {
    return <LockScreen onUnlock={() => setStatus("unlocked")} />;
  }

  return (
    <Tabs defaultValue="schedule">
      <TabsList>
        <TabsTrigger value="schedule">Денежное расписание</TabsTrigger>
        <TabsTrigger value="payments">Оплата занятий</TabsTrigger>
        <TabsTrigger value="pricing">Настройка стоимости</TabsTrigger>
      </TabsList>

      <TabsContent value="schedule" className="mt-4">
        <MoneyScheduleSection />
      </TabsContent>
      <TabsContent value="payments" className="mt-4">
        <PaymentsSection />
      </TabsContent>
      <TabsContent value="pricing" className="mt-4">
        <PricingSection />
      </TabsContent>
    </Tabs>
  );
}

function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiPost("/api/accounting/unlock", { password, remember });
      onUnlock();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto flex max-w-sm flex-col items-center gap-4 p-8 text-center">
      <span className="brand-badge size-12">
        <Lock className="size-6" />
      </span>
      <div>
        <h2 className="text-lg font-semibold">Бухгалтерия защищена</h2>
        <p className="mt-1 text-sm text-muted-foreground">Введите пароль для доступа.</p>
      </div>
      <form className="flex w-full flex-col gap-3" onSubmit={submit}>
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Пароль"
          autoFocus
        />
        <label className="flex cursor-pointer items-center gap-2 text-left text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="size-4 accent-primary"
          />
          Не спрашивать 30 минут
        </label>
        <Button type="submit" disabled={busy || !password}>
          Войти
        </Button>
      </form>
    </Card>
  );
}

