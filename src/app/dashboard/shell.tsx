"use client";

import { useMemo } from "react";
import type { SlotWithBooking } from "@/lib/domain";
import type { BookingEvent, BookingWithSlot, StudentOverview } from "@/lib/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AutoRefresh } from "@/components/auto-refresh";
import { DashboardHeader } from "./dashboard-header";
import { ScheduleTab } from "./schedule-tab";
import { RequestsTab } from "./requests-tab";
import { StudentsTab } from "./students-tab";
import { HistoryTab } from "./history-tab";

export type StudentOption = { id: string; name: string };

interface Props {
  slots: SlotWithBooking[];
  bookings: BookingWithSlot[];
  bookingUrl: string;
  unseen: number;
  overview: StudentOverview[];
  history: BookingEvent[];
}

export function DashboardShell({ slots, bookings, bookingUrl, unseen, overview, history }: Props) {
  const freeSlots = useMemo(
    () => slots.filter((s) => s.is_active && !s.booking),
    [slots],
  );
  const pendingCount = bookings.filter((b) => b.status === "pending").length;
  const studentOptions: StudentOption[] = useMemo(
    () => overview.map((s) => ({ id: s.id, name: s.name })),
    [overview],
  );

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
      <AutoRefresh seconds={12} />
      <DashboardHeader bookingUrl={bookingUrl} unseen={unseen} />

      <Tabs defaultValue="schedule" className="mt-6">
        <TabsList>
          <TabsTrigger value="schedule">Расписание</TabsTrigger>
          <TabsTrigger value="requests" className="gap-2">
            Заявки
            {pendingCount > 0 && (
              <Badge variant="secondary" className="rounded-full px-1.5">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="students">Ученики</TabsTrigger>
          <TabsTrigger value="history">История</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <ScheduleTab slots={slots} />
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <RequestsTab bookings={bookings} freeSlots={freeSlots} students={studentOptions} />
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          <StudentsTab overview={overview} />
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <HistoryTab history={history} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
