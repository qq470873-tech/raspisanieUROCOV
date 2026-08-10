"use client";

import { useMemo } from "react";
import { Users } from "lucide-react";
import { STATUS_LABELS, formatRange, weekdayShort, type BookingStatus } from "@/lib/domain";
import type { StudentOverview } from "@/lib/queries";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const DOT: Record<BookingStatus, string> = {
  pending: "bg-amber-400",
  confirmed: "bg-emerald-500",
  rejected: "bg-red-400",
  proposed: "bg-sky-400",
  cancelled: "bg-muted-foreground/40",
};

export function StudentsTab({ overview }: { overview: StudentOverview[] }) {
  // Группируем по household (братья/сёстры вместе).
  const households = useMemo(() => {
    const map = new Map<string, StudentOverview[]>();
    for (const s of overview) {
      const arr = map.get(s.household_id) ?? [];
      arr.push(s);
      map.set(s.household_id, arr);
    }
    return [...map.values()];
  }, [overview]);

  if (overview.length === 0) {
    return (
      <Card className="p-10 text-center text-muted-foreground">
        Пока никто не зарегистрировался.
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {households.map((members, i) => (
        <Card key={i} className="flex flex-col gap-3 p-4">
          {members.length > 1 && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Users className="size-3.5" /> Семья ({members.length})
            </div>
          )}
          {members.map((s) => (
            <div key={s.id} className="flex flex-col gap-1.5">
              <div className="font-medium">{s.name}</div>
              {s.bookings.length === 0 ? (
                <p className="text-xs text-muted-foreground">Нет активных записей</p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {s.bookings.map((b, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm">
                      <span className={`size-2 shrink-0 rounded-full ${DOT[b.status]}`} />
                      <span className="tabular-nums">
                        {weekdayShort(b.weekday)} {formatRange(b.start_time, b.end_time)}
                      </span>
                      {b.asPartner && (
                        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                          пара
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {STATUS_LABELS[b.status]}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </Card>
      ))}
    </div>
  );
}
