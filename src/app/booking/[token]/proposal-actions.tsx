"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiPost } from "@/lib/client";
import { Button } from "@/components/ui/button";

export function ProposalActions({ accessToken }: { accessToken: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function respond(accept: boolean) {
    setBusy(true);
    try {
      await apiPost("/api/proposal", { access_token: accessToken, accept });
      toast.success(accept ? "Время принято" : "Предложение отклонено");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 flex gap-2">
      <Button onClick={() => respond(true)} disabled={busy} className="flex-1">
        Принять
      </Button>
      <Button variant="outline" onClick={() => respond(false)} disabled={busy} className="flex-1">
        Отклонить
      </Button>
    </div>
  );
}
