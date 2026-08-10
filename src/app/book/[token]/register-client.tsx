"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
import { apiPost } from "@/lib/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterClient({ token }: { token: string }) {
  const router = useRouter();
  const [child1, setChild1] = useState("");
  const [child2, setChild2] = useState("");
  const [hasSecond, setHasSecond] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const names = [child1.trim()];
    if (child1.trim().length < 2) {
      toast.error("Укажите имя и фамилию ученика");
      return;
    }
    if (hasSecond) {
      if (child2.trim().length < 2) {
        toast.error("Укажите имя и фамилию второго ребёнка");
        return;
      }
      names.push(child2.trim());
    }
    setBusy(true);
    try {
      await apiPost("/api/student/register", { token, names, email });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }

  return (
    <Card className="mx-auto w-full max-w-md p-6 shadow-lg shadow-primary/5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="child1">Имя и фамилия ученика *</Label>
          <Input
            id="child1"
            value={child1}
            onChange={(e) => setChild1(e.target.value)}
            placeholder="Например: Вася Иванов"
            autoFocus
          />
        </div>

        {hasSecond ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="child2">Второй ребёнок *</Label>
              <button
                type="button"
                onClick={() => {
                  setHasSecond(false);
                  setChild2("");
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" /> убрать
              </button>
            </div>
            <Input
              id="child2"
              value={child2}
              onChange={(e) => setChild2(e.target.value)}
              placeholder="Имя и фамилия"
            />
            <p className="text-xs text-muted-foreground">
              Каждому ребёнку выберете своё время на следующем шаге.
            </p>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setHasSecond(true)}
            className="flex items-center gap-1.5 self-start text-sm font-medium text-primary hover:underline"
          >
            <Plus className="size-4" /> Добавить второго ребёнка
          </button>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="email">Email для уведомлений</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Необязательно — сообщим о решении"
          />
        </div>

        <Button size="lg" className="mt-1 h-11 text-base" onClick={submit} disabled={busy}>
          {busy ? "Секунду…" : "Выбрать время →"}
        </Button>
      </div>
    </Card>
  );
}
