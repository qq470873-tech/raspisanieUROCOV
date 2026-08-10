"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Copy, GraduationCap, LogOut, RefreshCw, Share2 } from "lucide-react";
import { apiPost, apiSend } from "@/lib/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function DashboardHeader({ bookingUrl, unseen }: { bookingUrl: string; unseen: number }) {
  const router = useRouter();
  const [url, setUrl] = useState(bookingUrl);
  const [copied, setCopied] = useState(false);

  // Отмечаем новые заявки просмотренными при открытии панели.
  useEffect(() => {
    if (unseen > 0) apiSend("/api/notifications/seen", "POST").catch(() => {});
  }, [unseen]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success("Ссылка скопирована");
    setTimeout(() => setCopied(false), 1500);
  }

  async function rotate() {
    if (!confirm("Перевыпустить ссылку? Старая перестанет работать.")) return;
    try {
      const res = await apiPost<{ token: string }>("/api/link/rotate");
      const base = url.replace(/\/book\/.*$/, "");
      setUrl(`${base}/book/${res.token}`);
      toast.success("Новая ссылка готова");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка");
    }
  }

  async function logout() {
    await apiSend("/api/logout", "POST").catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  return (
    <header className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="brand-badge size-11">
            <GraduationCap className="size-6" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Расписание уроков</h1>
            <p className="text-sm text-muted-foreground">Панель преподавателя</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={logout} className="gap-2">
          <LogOut className="size-4" />
          Выйти
        </Button>
      </div>

      <Card className="flex flex-col gap-3 border-primary/20 bg-primary/5 p-4 ring-primary/15 sm:flex-row sm:items-center">
        <div className="flex-1">
          <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <Share2 className="size-4 text-primary" />
            Ссылка для родителей
          </p>
          <p className="text-xs text-muted-foreground">
            Отправьте её в родительский чат — по ней записываются на свободное время.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input readOnly value={url} className="w-full sm:w-72 text-sm" />
          <Button variant="outline" size="icon" onClick={copy} title="Скопировать">
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
          <Button variant="outline" size="icon" onClick={rotate} title="Перевыпустить ссылку">
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </Card>
    </header>
  );
}
