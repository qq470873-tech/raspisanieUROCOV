"use client";

import { useMemo } from "react";
import type { SlotWithBooking } from "@/lib/domain";
import type { BookingWithSlot } from "@/lib/queries";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { DashboardHeader } from "./dashboard-header";
import { ScheduleTab } from "./schedule-tab";
import { RequestsTab } from "./requests-tab";

interface Props {
  slots: SlotWithBooking[];
  bookings: BookingWithSlot[];
  bookingUrl: string;
  unseen: number;
}

export function DashboardShell({ slots, bookings, bookingUrl, unseen }: Props) {
  const freeSlots = useMemo(
    () => slots.filter((s) => s.is_active && !s.booking),
    [slots],
  );
  const pendingCount = bookings.filter((b) => b.status === "pending").length;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:py-8">
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
        </TabsList>

        <TabsContent value="schedule" className="mt-4">
          <ScheduleTab slots={slots} />
        </TabsContent>

        <TabsContent value="requests" className="mt-4">
          <RequestsTab bookings={bookings} freeSlots={freeSlots} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
