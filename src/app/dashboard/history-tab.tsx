"use client";

import { formatRange, weekdayLong } from "@/lib/domain";
import type { BookingEvent } from "@/lib/queries";
import { Card } from "@/components/ui/card";

const ACTION: Record<string, { label: string; className: string }> = {
  requested: { label: "Попросил(ась)", className: "text-amber-600" },
  confirmed: { label: "Подтверждено", className: "text-emerald-600" },
  rejected: { label: "Отклонено", className: "text-red-600" },
  auto_rejected: { label: "Авто-отказ (время заняли)", className: "text-red-500" },
  cancelled: { label: "Освобождено", className: "text-muted-foreground" },
  moved: { label: "Перенесено", className: "text-sky-600" },
  proposed: { label: "Предложено время", className: "text-sky-600" },
  paired: { label: "Стало парным", className: "text-violet-600" },
  accepted: { label: "Ученик принял", className: "text-emerald-600" },
  declined: { label: "Ученик отклонил", className: "text-red-500" },
  deleted: { label: "Удалено", className: "text-muted-foreground" },
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function HistoryTab({ history }: { history: BookingEvent[] }) {
  if (history.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        История пуста — здесь появятся все заявки и решения.
      </Card>
    );
  }

  return (
    <Card className="divide-y divide-border p-0">
      {history.map((e) => {
        const a = ACTION[e.action] ?? { label: e.action, className: "text-foreground" };
        const when =
          e.weekday != null && e.start_time && e.end_time
            ? `${weekdayLong(e.weekday)}, ${formatRange(e.start_time, e.end_time)}`
            : "";
        return (
          <div key={e.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 text-sm">
                <span className="font-medium">
                  {e.student_name}
                  {e.partner_name ? ` + ${e.partner_name}` : ""}
                </span>
                <span className={`font-medium ${a.className}`}>· {a.label}</span>
              </div>
              {when && <div className="text-xs text-muted-foreground">{when}</div>}
            </div>
            <time className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
              {fmtDate(e.created_at)}
            </time>
          </div>
        );
      })}
    </Card>
  );
}
